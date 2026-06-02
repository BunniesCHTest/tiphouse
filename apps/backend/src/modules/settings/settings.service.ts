import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { OverlayService } from "../overlay/overlay.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CompleteCreatorOnboardingDto, UpdateOverlayDto, UpdateProfileDto, UpsertPayoutDto } from "./dto";

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

  async completeOnboarding(userId: string, dto: CompleteCreatorOnboardingDto) {
    await this.ensureApproved(userId);
    const displayName = dto.displayName.trim();
    const slug = dto.slug.trim().toLowerCase();

    if (!/^[a-z0-9-]{4,20}$/.test(slug)) {
      throw new BadRequestException("Donation URL must be 4-20 lowercase letters, numbers, or hyphens");
    }

    const [slugOwner, usernameOwner] = await Promise.all([
      this.prisma.donationPage.findUnique({ where: { slug }, select: { userId: true } }),
      this.prisma.user.findUnique({ where: { username: slug }, select: { id: true } }),
    ]);

    if ((slugOwner && slugOwner.userId !== userId) || (usernameOwner && usernameOwner.id !== userId)) {
      throw new ConflictException("Donation URL is already used by another creator");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: slug,
        page: {
          upsert: {
            create: {
              slug,
              displayName,
              handle: `@${slug}`,
              minAmount: 20,
              goalAmount: 5000,
              donationAccountName: "TipHouse Donate",
              theme: {},
            },
            update: {
              slug,
              displayName,
              handle: `@${slug}`,
            },
          },
        },
      },
    });

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
    const current = await this.prisma.overlaySetting.findUnique({ where: { userId } });
    const theme = this.mergeOverlayTheme(current?.theme, dto.theme) as Prisma.InputJsonValue | undefined;
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

  async resetOverlayUrl(userId: string) {
    await this.ensureApproved(userId);
    const streamerKey = await this.generateUniqueStreamerKey();
    return this.prisma.overlaySetting.upsert({
      where: { userId },
      update: { streamerKey },
      create: { userId, streamerKey, theme: {}, animation: {}, ttsEnabled: true },
    });
  }

  async testOverlay(userId: string, dto?: UpdateOverlayDto) {
    await this.ensureApproved(userId);
    if (dto && Object.keys(dto).length) {
      await this.updateOverlay(userId, dto);
    }
    const overlay = await this.prisma.overlaySetting.findUniqueOrThrow({ where: { userId } });
    this.overlay.emitPaidDonation(overlay.streamerKey, {
      donorName: dto?.testDonorName ?? "Test Overlay",
      amount: Number(dto?.testAmount ?? 100),
      message: dto?.testMessage ?? "\u0e2a\u0e39\u0e49\u0e46\u0e19\u0e30\u0e04\u0e23\u0e31\u0e1a",
      anonymous: false,
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

  private async generateUniqueStreamerKey() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const token = randomUUID().replace(/-/g, "");
      const existing = await this.prisma.overlaySetting.findUnique({ where: { streamerKey: token } });
      if (!existing) return token;
    }
    throw new Error("Unable to generate unique overlay token");
  }

  private mergeOverlayTheme(currentTheme: unknown, nextTheme?: Record<string, unknown>) {
    if (!nextTheme) return undefined;
    const current = typeof currentTheme === "object" && currentTheme ? currentTheme as Record<string, any> : {};
    const next = { ...nextTheme } as Record<string, any>;
    if (current.streamlabs || next.streamlabs) {
      next.streamlabs = {
        ...(current.streamlabs ?? {}),
        ...(next.streamlabs ?? {}),
        accessToken: current.streamlabs?.accessToken,
        refreshToken: current.streamlabs?.refreshToken,
        tokenType: current.streamlabs?.tokenType,
        userId: current.streamlabs?.userId ?? next.streamlabs?.userId,
        connectedAt: current.streamlabs?.connectedAt ?? next.streamlabs?.connectedAt,
        connected: Boolean(current.streamlabs?.connected ?? next.streamlabs?.connected),
      };
    }
    return JSON.parse(JSON.stringify(next));
  }
}
