import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateOverlayDto, UpsertPayoutDto } from "./dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getPayout(userId: string) {
    return this.prisma.payoutAccount.findUnique({ where: { userId } });
  }

  upsertPayout(userId: string, dto: UpsertPayoutDto) {
    return this.prisma.payoutAccount.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  getOverlay(userId: string) {
    return this.prisma.overlaySetting.findUnique({ where: { userId } });
  }

  updateOverlay(userId: string, dto: UpdateOverlayDto) {
    const theme = dto.theme as Prisma.InputJsonValue | undefined;
    const animation = dto.animation as Prisma.InputJsonValue | undefined;
    return this.prisma.overlaySetting.upsert({
      where: { userId },
      update: {
        streamerKey: dto.streamerKey,
        soundUrl: dto.soundUrl,
        ttsEnabled: dto.ttsEnabled,
        theme,
        animation,
      },
      create: {
        userId,
        streamerKey: dto.streamerKey,
        soundUrl: dto.soundUrl,
        ttsEnabled: dto.ttsEnabled ?? true,
        theme: theme ?? {},
        animation: animation ?? {},
      },
    });
  }
}
