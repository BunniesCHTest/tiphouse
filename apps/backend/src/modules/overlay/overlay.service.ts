import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OverlayGateway } from "./overlay.gateway";

@Injectable()
export class OverlayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OverlayGateway,
  ) {}

  async getSettings(streamerKey: string) {
    const overlay = await this.prisma.overlaySetting.findUnique({
      where: { streamerKey },
      include: { user: { include: { page: true } } },
    });
    if (!overlay) return null;
    const theme = typeof overlay.theme === "object" && overlay.theme ? overlay.theme as Record<string, any> : {};
    const streamlabs = typeof theme.streamlabs === "object" && theme.streamlabs ? theme.streamlabs : undefined;
    const donateGoal = typeof theme.donateGoal === "object" && theme.donateGoal ? theme.donateGoal : {};
    const goalStartDate = this.parseGoalDate(donateGoal.startDate);
    const goalResetAt = this.parseGoalDate(donateGoal.resetAt);
    const goalEndDate = this.parseGoalDate(donateGoal.endDate, true);
    const goalCreatedAt: { gte?: Date; lte?: Date } = {};
    const goalStartCandidates = [goalStartDate, goalResetAt].filter((date): date is Date => Boolean(date));
    if (goalStartCandidates.length > 0) {
      goalCreatedAt.gte = goalStartCandidates.reduce((latest, date) => date > latest ? date : latest);
    }
    if (goalEndDate) {
      goalCreatedAt.lte = goalEndDate;
    }
    const total = await this.prisma.donation.aggregate({
      where: {
        userId: overlay.userId,
        paymentStatus: "PAID",
        ...(Object.keys(goalCreatedAt).length > 0 ? { createdAt: goalCreatedAt } : {}),
      },
      _sum: { amount: true },
    });
    const safeTheme = {
      ...theme,
      ...(streamlabs
        ? {
            streamlabs: {
              connected: Boolean(streamlabs.connected),
              alertBoxEnabled: Boolean(streamlabs.alertBoxEnabled),
              username: streamlabs.username,
            },
          }
        : {}),
    };
    return {
      ...overlay,
      theme: safeTheme,
      donationGoal: {
        title: donateGoal.title ?? overlay.user.page?.displayName ?? "Donate Goal",
        currentAmount: total._sum.amount ?? 0,
        targetAmount: donateGoal.targetAmount ?? overlay.user.page?.goalAmount ?? 0,
        startAmount: 0,
      },
      user: undefined,
    };
  }

  emitPaidDonation(streamerKey: string, payload: unknown) {
    this.gateway.emitDonation(streamerKey, payload);
  }

  private parseGoalDate(value: unknown, endOfDay = false) {
    if (typeof value !== "string" || !value.trim()) return null;
    const raw = value.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`)
      : new Date(raw);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  async generateThaiTts(text: string) {
    const safeText = text.trim().replace(/\s+/g, " ").slice(0, 180);
    if (!safeText) return Buffer.from("");

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=${encodeURIComponent(safeText)}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "audio/mpeg,*/*",
        "Referer": "https://translate.google.com/",
        "User-Agent": "Mozilla/5.0 TipHouse TTS",
      },
    });

    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }

    throw new Error("Thai TTS request failed");
  }
}
