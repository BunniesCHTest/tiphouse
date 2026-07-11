import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentProvider } from "@prisma/client";
import Stripe = require("stripe");
import { DonationsService } from "../donations/donations.service";
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
      }, { recordStreamlabsHistory: true, saveStreamlabsHistoryAsync: true })
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
