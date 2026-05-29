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
    const overlay = await this.prisma.overlaySetting.findUnique({ where: { streamerKey } });
    return overlay;
  }

  emitPaidDonation(streamerKey: string, payload: unknown) {
    this.gateway.emitDonation(streamerKey, payload);
  }

  async generateThaiTts(text: string) {
    const safeText = text.trim().replace(/\s+/g, " ").slice(0, 180);
    if (!safeText) return Buffer.from("");

    const url = new URL("https://translate.google.com/translate_tts");
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("tl", "th");
    url.searchParams.set("q", safeText);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 TipHouse TTS",
      },
    });

    if (!response.ok) {
      throw new Error(`Thai TTS request failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
