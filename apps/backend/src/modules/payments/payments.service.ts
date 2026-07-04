import { BadRequestException, ConflictException, GoneException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentProvider } from "@prisma/client";
import { createHash } from "crypto";
import Stripe from "stripe";
import { decryptSecret } from "../../common/secret-box";
import { DonationsService } from "../donations/donations.service";
import { thaiQrRecipientValues } from "../donations/thai-qr";
import { AlertDeliveryService } from "../overlay/alert-delivery.service";
import { PrismaService } from "../../prisma/prisma.service";

interface GatewayPayload {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    metadata?: { transactionRef?: string };
  };
  transactionRef?: string;
  status?: string;
}

type SlipFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type SlipOkResult = {
  success?: boolean;
  code?: number;
  message?: string;
  data?: {
    success?: boolean;
    message?: string;
    transRef?: string;
    transTimestamp?: string;
    amount?: number;
    receivingBank?: string;
    sendingBank?: string;
    toMerchantId?: string | null;
    receiver?: {
      displayName?: string;
      name?: string;
      proxy?: { value?: string | null };
      account?: { value?: string | null };
    };
  };
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly donations: DonationsService,
    private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async handleOmiseWebhook(payload: unknown, signature?: string) {
    this.verifyWebhookSignature("OMISE", payload, signature, this.config.get<string>("OMISE_WEBHOOK_SECRET"));
    const data = payload as GatewayPayload;
    await this.logWebhook("OMISE", data.type ?? "unknown", true, data);

    if (data.type !== "charge.complete" || data.data?.status !== "successful") return { ok: true, ignored: true };
    const transactionRef = data.data.metadata?.transactionRef;
    if (!transactionRef) throw new BadRequestException("Missing transactionRef");
    return this.finalizePaidDonation(transactionRef);
  }

  async handleGbPrimePayWebhook(payload: unknown, signature?: string) {
    this.verifyWebhookSignature("GBPRIMEPAY", payload, signature, this.config.get<string>("GBPRIMEPAY_SECRET"));
    const data = payload as GatewayPayload;
    await this.logWebhook("GBPRIMEPAY", "callback", true, data);

    if (data.status !== "paid" || !data.transactionRef) return { ok: true, ignored: true };
    return this.finalizePaidDonation(data.transactionRef);
  }

  async handleStripeWebhook(rawBody?: Buffer, signature?: string) {
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY")?.trim();
    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!secretKey || !webhookSecret) {
      throw new ServiceUnavailableException("Stripe webhook is not configured");
    }
    if (!rawBody?.length) throw new BadRequestException("Missing Stripe raw webhook body");
    if (!signature) throw new BadRequestException("Missing Stripe signature");

    const stripe = new Stripe(secretKey);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException("Invalid Stripe webhook signature");
    }

    await this.logWebhook("STRIPE", event.type, true, event);
    if (![
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "payment_intent.canceled",
    ].includes(event.type)) {
      return { ok: true, ignored: true };
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    const transactionRef = intent.metadata?.transactionRef;
    if (!transactionRef) return { ok: true, ignored: true };

    const donation = await this.prisma.donation.findUnique({
      where: { transactionRef },
      select: {
        id: true,
        amount: true,
        paymentProvider: true,
        providerTransactionId: true,
      },
    });
    if (!donation) return { ok: true, ignored: true };
    if (
      donation.paymentProvider !== PaymentProvider.STRIPE
      || donation.providerTransactionId !== intent.id
    ) {
      throw new BadRequestException("Stripe payment does not match this donation");
    }

    if (event.type === "payment_intent.succeeded") {
      if (intent.currency.toLowerCase() !== "thb" || intent.amount_received !== donation.amount * 100) {
        throw new BadRequestException("Stripe payment amount or currency does not match");
      }
      return this.finalizePaidDonation(transactionRef);
    }

    await this.prisma.donation.updateMany({
      where: { id: donation.id, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
    return { ok: true, status: "FAILED" };
  }

  async verifySlip(transactionRef: string, slip?: SlipFile) {
    if (!slip) throw new BadRequestException("กรุณาแนบรูปสลิปการโอนเงิน");
    const donation = await this.prisma.donation.findUnique({
      where: { transactionRef },
      include: { user: { include: { payout: true, overlay: true } } },
    });
    if (!donation) throw new BadRequestException("ไม่พบรายการโดเนท");
    if (donation.paymentStatus === "PAID") {
      return { ok: true, status: "PAID", alreadyProcessed: true, transactionRef };
    }
    const expiresAt = donation.expiresAt ?? new Date(donation.createdAt.getTime() + 10 * 60 * 1000);
    if (Date.now() >= expiresAt.getTime()) {
      await this.prisma.donation.updateMany({
        where: { id: donation.id, paymentStatus: "PENDING" },
        data: { paymentStatus: "EXPIRED" },
      });
      throw new GoneException("QR Code หมดอายุแล้ว กรุณาสร้างรายการใหม่");
    }
    if (!donation.qrPayload || !donation.user.payout?.receivingQrPayload) {
      throw new BadRequestException("รายการนี้ไม่มีข้อมูล QR สำหรับตรวจสอบผู้รับ");
    }

    const result = await this.checkSlipOk(slip, donation.amount, donation.user.payout);
    const data = result.data;
    if (!result.success || !data?.success || !data.transRef) {
      throw new BadRequestException(result.message ?? data?.message ?? "ตรวจสอบสลิปไม่สำเร็จ");
    }
    if (Math.abs(Number(data.amount) - donation.amount) > 0.001) {
      throw new BadRequestException("ยอดเงินในสลิปไม่ตรงกับยอดโดเนท");
    }
    if (!this.receiverMatchesQr(donation.qrPayload, data)) {
      throw new BadRequestException("บัญชีผู้รับในสลิปไม่ตรงกับ QR Code ของ Creator");
    }

    const duplicate = await this.prisma.donation.findFirst({
      where: { slipTransactionRef: data.transRef, id: { not: donation.id } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("สลิปนี้ถูกใช้ยืนยันรายการอื่นแล้ว");

    const verification = {
      provider: "SLIPOK",
      transRef: data.transRef,
      transTimestamp: data.transTimestamp ?? null,
      amount: Number(data.amount),
      receivingBank: data.receivingBank ?? null,
      sendingBank: data.sendingBank ?? null,
      receiver: {
        displayName: data.receiver?.displayName ?? null,
        name: data.receiver?.name ?? null,
        proxy: data.receiver?.proxy?.value ?? null,
        account: data.receiver?.account?.value ?? null,
        merchantId: data.toMerchantId ?? null,
      },
    };

    try {
      await this.prisma.donation.update({
        where: { id: donation.id },
        data: {
          slipTransactionRef: data.transRef,
          slipVerification: verification,
          verifiedAt: new Date(),
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("สลิปนี้ถูกใช้ยืนยันรายการอื่นแล้ว");
      }
      throw error;
    }

    const finalized = await this.finalizePaidDonation(transactionRef);
    return { ...finalized, status: "PAID", transactionRef };
  }

  private async checkSlipOk(
    slip: SlipFile,
    amount: number,
    payout: { slipOkBranchId?: string | null; slipOkApiKeyEncrypted?: string | null } | null,
  ): Promise<SlipOkResult> {
    const mockMode = this.config.get<string>("SLIPOK_MOCK_MODE") === "true"
      && this.config.get<string>("NODE_ENV") !== "production";
    if (mockMode) {
      return {
        success: true,
        data: {
          success: true,
          message: "LOCAL MOCK",
          transRef: `MOCK-${createHash("sha256").update(slip.buffer).digest("hex").slice(0, 24)}`,
          transTimestamp: new Date().toISOString(),
          amount,
          toMerchantId: "TIPHOUSE-MOCK",
        },
      };
    }

    const branchId = payout?.slipOkBranchId?.trim();
    const encryptedApiKey = payout?.slipOkApiKeyEncrypted?.trim();
    if (!branchId || !encryptedApiKey) {
      throw new ServiceUnavailableException("ระบบตรวจสลิปยังไม่ได้ตั้งค่า SlipOK");
    }
    const apiKey = decryptSecret(encryptedApiKey, this.credentialEncryptionKey());
    const form = new FormData();
    const slipBytes = new Uint8Array(slip.buffer.byteLength);
    slipBytes.set(slip.buffer);
    form.append("files", new Blob([slipBytes], { type: slip.mimetype }), slip.originalname || "slip.jpg");
    // Each creator owns a SlipOK branch, so SlipOK can also enforce receiver
    // matching and duplicate-slip protection for that creator.
    form.append("log", "true");
    form.append("amount", String(amount));
    const response = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}`, {
      method: "POST",
      headers: { "x-authorization": apiKey },
      body: form,
    });
    const body = await response.json().catch(() => ({})) as SlipOkResult;
    if (!response.ok) {
      throw new BadRequestException(body.message ?? `SlipOK returned HTTP ${response.status}`);
    }
    return body;
  }

  private credentialEncryptionKey() {
    const configured = this.config.get<string>("CREDENTIAL_ENCRYPTION_KEY")?.trim();
    if (configured) return configured;
    const developmentFallback = this.config.get<string>("NODE_ENV") !== "production"
      ? this.config.get<string>("JWT_ACCESS_SECRET")?.trim()
      : undefined;
    if (developmentFallback) return developmentFallback;
    throw new ServiceUnavailableException("ระบบยังไม่ได้ตั้งค่า CREDENTIAL_ENCRYPTION_KEY");
  }

  private receiverMatchesQr(qrPayload: string, slip: NonNullable<SlipOkResult["data"]>) {
    if (this.config.get<string>("SLIPOK_MOCK_MODE") === "true"
      && this.config.get<string>("NODE_ENV") !== "production") return true;
    const expected = thaiQrRecipientValues(qrPayload);
    const actual = [
      slip.toMerchantId,
      slip.receiver?.proxy?.value,
      slip.receiver?.account?.value,
    ].filter((value): value is string => Boolean(value));
    return expected.some((candidate) => actual.some((masked) => this.maskedIdentifierMatches(candidate, masked)));
  }

  private maskedIdentifierMatches(expectedValue: string, maskedValue: string) {
    const expectedRaw = expectedValue.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const expectedVariants = new Set([expectedRaw]);
    if (expectedRaw.startsWith("0066")) expectedVariants.add(`0${expectedRaw.slice(4)}`);
    const visibleChunks = maskedValue
      .toUpperCase()
      .split(/[X*•\-_\s]+/)
      .map((value) => value.replace(/[^A-Z0-9]/g, ""))
      .filter((value) => value.length >= 3);
    if (!visibleChunks.length) return false;
    return [...expectedVariants].some((expected) => visibleChunks.every((chunk) => expected.includes(chunk)));
  }

  private async finalizePaidDonation(transactionRef: string) {
    const donation = await this.donations.markPaid(transactionRef);
    if (donation.alreadyProcessed) {
      return { ok: true, donationId: donation.id, alreadyProcessed: true };
    }
    const streamerKey = donation.user.overlay?.streamerKey;
    const delivery = donation.user.overlay && streamerKey
      ? await this.alertDelivery.deliver(donation.user.overlay, {
        donationId: donation.id,
        donorName: donation.anonymous ? "Anonymous" : donation.donorName,
        amount: donation.amount,
        message: donation.message,
        anonymous: donation.anonymous,
        createdAt: donation.paidAt?.toISOString() ?? new Date().toISOString(),
      }, { recordStreamlabsHistory: true })
      : { ok: false, provider: "none", reason: "Creator has no overlay configuration" };
    return { ok: true, donationId: donation.id, alert: delivery };
  }

  private verifyWebhookSignature(provider: string, payload: unknown, signature?: string, secret?: string) {
    if (!secret) throw new BadRequestException(`${provider} webhook secret is not configured`);
    if (!signature) throw new BadRequestException("Missing webhook signature");
    // Replace this placeholder with each gateway's official HMAC/signature verification.
    // Keep this check server-side only; never accept payment status from frontend.
    if (signature !== secret) throw new BadRequestException("Invalid webhook signature");
    void payload;
  }

  private logWebhook(provider: string, eventType: string, signatureOk: boolean, payload: object) {
    return this.prisma.webhookLog.create({ data: { provider, eventType, signatureOk, payload } });
  }
}
