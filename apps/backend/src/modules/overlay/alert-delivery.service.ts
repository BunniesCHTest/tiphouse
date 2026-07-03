import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { OverlayService } from "./overlay.service";

type OverlayRecord = {
  streamerKey: string;
  theme: unknown;
  animation: unknown;
  soundUrl: string | null;
  ttsEnabled: boolean;
};

type AlertPayload = {
  donationId?: string;
  donorName: string;
  amount: number;
  message: string;
  anonymous: boolean;
  createdAt?: string;
};

@Injectable()
export class AlertDeliveryService {
  private readonly logger = new Logger(AlertDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly overlay: OverlayService,
  ) {}

  async deliver(overlay: OverlayRecord, payload: AlertPayload) {
    const streamlabs = this.streamlabsSettings(overlay.theme);
    if (streamlabs?.alertBoxEnabled) {
      if (!streamlabs.connected || !streamlabs.accessToken) {
        return { ok: false, provider: "streamlabs", reason: "Streamlabs is not connected" };
      }
      return this.deliverToStreamlabs(streamlabs.accessToken, payload);
    }

    this.overlay.emitPaidDonation(overlay.streamerKey, {
      ...payload,
      settings: {
        theme: overlay.theme,
        animation: overlay.animation,
        soundUrl: overlay.soundUrl,
        ttsEnabled: overlay.ttsEnabled,
      },
    });
    return { ok: true, provider: "tiphouse" };
  }

  private async deliverToStreamlabs(accessToken: string, payload: AlertPayload) {
    const donationId = payload.donationId ?? "test";
    const deliveryId = `${donationId}-${randomUUID()}`;
    try {
      const response = await fetch("https://streamlabs.com/api/v2.0/donations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          name: payload.donorName.slice(0, 25).padEnd(2, "_"),
          identifier: deliveryId,
          amount: payload.amount,
          currency: "THB",
          message: payload.message.slice(0, 254),
          created_at: payload.createdAt ?? new Date().toISOString(),
          skip_alert: "no",
        }),
      });
      await this.logDelivery(donationId, response.ok, { deliveryId, status: response.status, ok: response.ok });
      return {
        ok: response.ok,
        provider: "streamlabs",
        status: response.status,
        reason: response.ok ? undefined : `Streamlabs returned HTTP ${response.status}`,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      this.logger.warn(`Streamlabs alert delivery failed: ${reason}`);
      await this.logDelivery(donationId, false, { deliveryId, error: reason });
      return { ok: false, provider: "streamlabs", reason };
    }
  }

  private streamlabsSettings(theme: unknown) {
    if (!theme || typeof theme !== "object") return undefined;
    return (theme as Record<string, any>).streamlabs;
  }

  private logDelivery(donationId: string, ok: boolean, details: Record<string, unknown>) {
    return this.prisma.webhookLog.create({
      data: {
        provider: "STREAMLABS",
        eventType: "alert.delivery",
        signatureOk: ok,
        payload: { donationId, ...details },
      },
    });
  }
}
