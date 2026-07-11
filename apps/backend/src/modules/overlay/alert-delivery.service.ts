import { Injectable, Logger } from "@nestjs/common";
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
  testMode?: boolean;
};

type DeliveryOptions = {
  recordStreamlabsHistory?: boolean;
  saveStreamlabsHistoryAsync?: boolean;
};

type StreamlabsDelivery = {
  ok: boolean;
  provider: "streamlabs";
  status?: number;
  reason?: string;
};

@Injectable()
export class AlertDeliveryService {
  private readonly logger = new Logger(AlertDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly overlay: OverlayService,
  ) {}

  async deliver(overlay: OverlayRecord, payload: AlertPayload, options: DeliveryOptions = {}) {
    const streamlabs = this.streamlabsSettings(overlay.theme);
    this.overlay.emitPaidDonation(overlay.streamerKey, {
      ...payload,
    });

    let streamlabsDelivery: StreamlabsDelivery | undefined;
    if (streamlabs?.connected && streamlabs.accessToken && (options.recordStreamlabsHistory || streamlabs.alertBoxEnabled)) {
      const deliveryTask = payload.testMode && streamlabs.alertBoxEnabled
        ? this.deliverTestAlertToStreamlabs(streamlabs.accessToken, payload)
        : this.deliverToStreamlabs(
          streamlabs.accessToken,
          payload,
          !streamlabs.alertBoxEnabled,
        );
      if (options.saveStreamlabsHistoryAsync || payload.testMode) {
        deliveryTask.catch((error) => this.logger.warn(`Streamlabs delivery failed after TipHouse overlay emit: ${error instanceof Error ? error.message : "unknown"}`));
      } else {
        streamlabsDelivery = await deliveryTask;
      }
    }

    return {
      ok: true,
      provider: "tiphouse",
      streamlabsHistory: streamlabsDelivery,
      fallbackReason: streamlabs?.alertBoxEnabled
        ? streamlabsDelivery?.reason ?? "Streamlabs is not connected"
        : undefined,
    };
  }

  private async deliverTestAlertToStreamlabs(accessToken: string, payload: AlertPayload): Promise<StreamlabsDelivery> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const body = new URLSearchParams({
        type: "donation",
        message: `${payload.donorName} donated \u0e3f${payload.amount}`,
        user_message: payload.message.slice(0, 254),
        duration: "3000",
      });
      const response = await fetch("https://streamlabs.com/api/v2.0/alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body,
        signal: controller.signal,
      });
      const responseText = (await response.text()).slice(0, 500);
      return {
        ok: response.ok,
        provider: "streamlabs",
        status: response.status,
        reason: response.ok ? undefined : `Streamlabs returned HTTP ${response.status}: ${responseText}`,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      return { ok: false, provider: "streamlabs", reason };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async deliverToStreamlabs(accessToken: string, payload: AlertPayload, skipAlert: boolean): Promise<StreamlabsDelivery> {
    const donationId = payload.donationId ?? "test";
    const deliveryId = `tiphouse-${donationId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const body = new URLSearchParams({
        name: payload.donorName.slice(0, 25).padEnd(2, "_"),
        identifier: deliveryId,
        amount: String(payload.amount),
        currency: "THB",
        message: payload.message.slice(0, 254),
        skip_alert: skipAlert ? "yes" : "no",
      });
      const response = await fetch("https://streamlabs.com/api/v2.0/donations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body,
        signal: controller.signal,
      });
      const responseText = (await response.text()).slice(0, 500);
      await this.logDelivery(donationId, response.ok, {
        deliveryId,
        status: response.status,
        ok: response.ok,
        skipAlert,
        response: responseText,
      });
      return {
        ok: response.ok,
        provider: "streamlabs",
        status: response.status,
        reason: response.ok ? undefined : `Streamlabs returned HTTP ${response.status}: ${responseText}`,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      this.logger.warn(`Streamlabs alert delivery failed: ${reason}`);
      await this.logDelivery(donationId, false, { deliveryId, error: reason });
      return { ok: false, provider: "streamlabs", reason };
    } finally {
      clearTimeout(timeout);
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
