import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateOverlayDto, UpdateProfileDto, UpsertPayoutDto } from "./dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getPayout(userId: string) {
    return this.prisma.payoutAccount.findUnique({ where: { userId } });
  }

  getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, pendingEmail: true, role: true, accountStatus: true, page: true },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const data: any = {};
    if (dto.username && dto.username !== current.username) data.username = dto.username;
    if (dto.email && dto.email !== current.email) {
      data.pendingEmail = dto.email;
      await this.prisma.approvalRequest.create({
        data: { userId, type: "EMAIL_CHANGE", requestedEmail: dto.email, note: "Email change request" },
      });
    }
    if (Object.keys(data).length) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    return this.getProfile(userId);
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
