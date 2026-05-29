import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateOverlayDto, UpdateProfileDto, UpsertPayoutDto } from "./dto";
import { OverlayService } from "../overlay/overlay.service";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overlay: OverlayService,
  ) {}

  async getPayout(userId: string) {
    await this.ensureApproved(userId);
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

  async upsertPayout(userId: string, dto: UpsertPayoutDto) {
    await this.ensureApproved(userId);
    return this.prisma.payoutAccount.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async getOverlay(userId: string) {
    await this.ensureApproved(userId);
    return this.prisma.overlaySetting.findUnique({ where: { userId } });
  }

  async updateOverlay(userId: string, dto: UpdateOverlayDto) {
    await this.ensureApproved(userId);
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

  async testOverlay(userId: string, dto?: UpdateOverlayDto) {
    await this.ensureApproved(userId);
    if (dto && Object.keys(dto).length) {
      await this.updateOverlay(userId, dto);
    }
    const overlay = await this.prisma.overlaySetting.findUniqueOrThrow({ where: { userId } });
    this.overlay.emitPaidDonation(overlay.streamerKey, {
      donorName: "Test Overlay",
      amount: 100,
      message: "ทดสอบข้อความโดเนท",
      settings: {
        theme: overlay.theme,
        animation: overlay.animation,
        soundUrl: overlay.soundUrl,
        ttsEnabled: overlay.ttsEnabled,
      },
    });
    return { ok: true, streamerKey: overlay.streamerKey };
  }

  private async ensureApproved(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { accountStatus: true } });
    if (user?.accountStatus !== "APPROVED") {
      throw new ForbiddenException("Account is waiting for admin approval");
    }
  }
}
