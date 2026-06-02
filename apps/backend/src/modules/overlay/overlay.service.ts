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
    const total = await this.prisma.donation.aggregate({
      where: { userId: overlay.userId, paymentStatus: "PAID" },
      _sum: { amount: true },
    });
    const theme = typeof overlay.theme === "object" && overlay.theme ? overlay.theme as Record<string, any> : {};
    const donateGoal = typeof theme.donateGoal === "object" && theme.donateGoal ? theme.donateGoal : {};
    return {
      ...overlay,
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
