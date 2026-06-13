import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { DonationsService } from "../donations/donations.service";
import { OverlayService } from "../overlay/overlay.service";
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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly donations: DonationsService,
    private readonly overlay: OverlayService,
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

  private async finalizePaidDonation(transactionRef: string) {
    const donation = await this.donations.markPaid(transactionRef);
    const sentToStreamlabs = await this.forwardDonationToStreamlabs(donation);
    const streamerKey = donation.user.overlay?.streamerKey;
    if (!sentToStreamlabs && streamerKey) {
      this.overlay.emitPaidDonation(streamerKey, {
        donationId: donation.id,
        donorName: donation.anonymous ? "Anonymous" : donation.donorName,
        amount: donation.amount,
        message: donation.message,
        anonymous: donation.anonymous,
        createdAt: donation.paidAt?.toISOString() ?? new Date().toISOString(),
        settings: donation.user.overlay
          ? {
              theme: donation.user.overlay.theme,
              animation: donation.user.overlay.animation,
              soundUrl: donation.user.overlay.soundUrl,
              ttsEnabled: donation.user.overlay.ttsEnabled,
            }
          : undefined,
      });
    }
    return { ok: true, donationId: donation.id };
  }

  private async forwardDonationToStreamlabs(donation: Awaited<ReturnType<DonationsService["markPaid"]>>) {
    const streamlabs = (donation.user.overlay?.theme as any)?.streamlabs;
    if (!streamlabs?.connected || !streamlabs?.alertBoxEnabled || !streamlabs?.accessToken) return false;
    const donorName = donation.anonymous ? "Anonymous" : donation.donorName;
    try {
      const response = await fetch("https://streamlabs.com/api/v2.0/donations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${streamlabs.accessToken}`,
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          name: donorName.slice(0, 25).padEnd(2, "_"),
          identifier: this.donorIdentifier(donation.id, donorName),
          amount: donation.amount,
          currency: "THB",
          message: donation.message.slice(0, 254),
          created_at: (donation.paidAt ?? new Date()).toISOString(),
          skip_alert: "no",
        }),
      });
      await this.prisma.webhookLog.create({
        data: {
          provider: "STREAMLABS",
          eventType: "donations.create",
          signatureOk: response.ok,
          payload: {
            donationId: donation.id,
            status: response.status,
            ok: response.ok,
          },
        },
      });
      return response.ok;
    } catch (error) {
      await this.prisma.webhookLog.create({
        data: {
          provider: "STREAMLABS",
          eventType: "donations.create",
          signatureOk: false,
          payload: { donationId: donation.id, error: error instanceof Error ? error.message : "unknown" },
        },
      });
      return false;
    }
  }

  private donorIdentifier(donationId: string, donorName: string) {
    return createHash("sha256").update(`${donationId}:${donorName}`).digest("hex");
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
