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
}
