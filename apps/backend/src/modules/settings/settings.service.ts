import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AlertDeliveryService } from "../overlay/alert-delivery.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CompleteCreatorOnboardingDto, UpdateOverlayDto, UpdateProfileDto, UpsertPayoutDto } from "./dto";
import { createFixedAmountThaiQr, verifyThaiQrPayload } from "../donations/thai-qr";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async getPayout(userId: string) {
    await this.ensureApproved(userId);
    const payout = await this.prisma.payoutAccount.findUnique({ where: { userId } });
    return this.publicPayout(payout);
  }

  async getProfile(userId: string) {
    const [profile, approvals] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          accountStatus: true,
          creatorSetupCompleted: true,
          donationNotificationEmail: true,
        },
      }),
      this.prisma.approvalRequest.findMany({
        where: { userId, type: "EMAIL_CHANGE" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          requestedEmail: true,
          note: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
    ]);
    return profile ? { ...profile, approvals } : null;
  }

  async getPage(userId: string) {
    await this.ensureApproved(userId);
    return this.prisma.donationPage.findUnique({ where: { userId } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const nextUsername = dto.username?.trim();
    const nextEmail = (dto.email ?? dto.donationNotificationEmail)?.trim().toLowerCase();
    const profileChange: Record<string, unknown> = {
      kind: "PROFILE_CHANGE",
      oldUsername: current.username,
      oldEmail: current.donationNotificationEmail ?? current.email,
      requestedAt: new Date().toISOString(),
    };

    if (nextUsername && nextUsername !== current.username) {
      if (!/^[a-z0-9]{4,30}$/.test(nextUsername)) {
        throw new BadRequestException("Username must be 4-30 lowercase letters or numbers");
      }
      const existing = await this.prisma.user.findUnique({ where: { username: nextUsername }, select: { id: true } });
      if (existing && existing.id !== userId) {
        throw new ConflictException("เนื่องจาก Username นี้มีผู้ใช้งานแล้วรบกวนระบุ Username ใหม่อีกครั้ง");
      }
      profileChange.newUsername = nextUsername;
    }

    if (nextEmail && nextEmail !== (current.donationNotificationEmail ?? current.email)) {
      profileChange.newEmail = nextEmail;
    }

    if (profileChange.newUsername || profileChange.newEmail) {
      await this.prisma.approvalRequest.create({
        data: {
          userId,
          type: "EMAIL_CHANGE",
          requestedEmail: typeof profileChange.newEmail === "string" ? profileChange.newEmail : null,
          note: JSON.stringify(profileChange),
        },
      });
    }
    return this.getProfile(userId);
  }

  async completeOnboarding(userId: string, dto: CompleteCreatorOnboardingDto) {
    await this.ensureApproved(userId);
    const displayName = dto.displayName.trim();
    const slug = dto.slug.trim().toLowerCase();
    const donationNotificationEmail = dto.donationNotificationEmail?.trim().toLowerCase() || null;

    if (!/^[a-z0-9]{4,30}$/.test(slug)) {
      throw new BadRequestException("Donation URL must be 4-30 lowercase letters or numbers");
    }

    const [slugOwner, usernameOwner] = await Promise.all([
      this.prisma.donationPage.findUnique({ where: { slug }, select: { userId: true } }),
      this.prisma.user.findUnique({ where: { username: slug }, select: { id: true } }),
    ]);

    if ((slugOwner && slugOwner.userId !== userId) || (usernameOwner && usernameOwner.id !== userId)) {
      throw new ConflictException("เนื่องจาก Username นี้มีผู้ใช้งานแล้วรบกวนระบุ Username ใหม่อีกครั้ง");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: slug,
        creatorSetupCompleted: true,
        donationNotificationEmail,
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
    const receivingQrPayload = dto.receivingQrPayload.replace(/\s+/g, "");
    if (!verifyThaiQrPayload(receivingQrPayload)) {
      throw new BadRequestException("QR Code รับเงินไม่ใช่ Thai QR Payment ที่ถูกต้อง");
    }
    // This also verifies that the QR contains a merchant account field and can
    // be converted into a fixed-amount dynamic QR.
    createFixedAmountThaiQr(receivingQrPayload, 10, "TIPHOUSE-CHECK");
    const data = {
      receivingQrImageUrl: dto.receivingQrImageUrl,
      receivingQrPayload,
      phone: dto.phone?.trim() || null,
      contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
      payoutMethod: "QR_TRANSFER",
    };
    const payout = await this.prisma.payoutAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return this.publicPayout(payout);
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
    const currentOverlay = await this.prisma.overlaySetting.findUniqueOrThrow({ where: { userId } });
    const overlay = dto && Object.keys(dto).length
      ? {
          ...currentOverlay,
          streamerKey: dto.streamerKey ?? currentOverlay.streamerKey,
          soundUrl: dto.soundUrl ?? currentOverlay.soundUrl,
          ttsEnabled: dto.ttsEnabled ?? currentOverlay.ttsEnabled,
          theme: this.mergeOverlayTheme(currentOverlay.theme, dto.theme) ?? currentOverlay.theme,
          animation: dto.animation ?? currentOverlay.animation,
        }
      : currentOverlay;
    const delivery = await this.alertDelivery.deliver(overlay, {
      donorName: dto?.testDonorName ?? "Test Overlay",
      amount: Number(dto?.testAmount ?? 100),
      message: dto?.testMessage ?? "\u0e2a\u0e39\u0e49\u0e46\u0e19\u0e30\u0e04\u0e23\u0e31\u0e1a",
      anonymous: false,
      testMode: true,
    });
    return { ...delivery, streamerKey: overlay.streamerKey };
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
    const next = { ...current, ...nextTheme } as Record<string, any>;
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

  private publicPayout(payout: any) {
    if (!payout) return null;
    const {
      id,
      userId,
      accountName,
      legalName,
      phone,
      contactEmail,
      taxId,
      address,
      bankName,
      branchName,
      accountType,
      accountNumber,
      payoutMethod,
      promptpayType,
      promptpayId,
      receivingQrImageUrl,
      receivingQrPayload,
      note,
      kycStatus,
      createdAt,
      updatedAt,
    } = payout;
    return {
      id,
      userId,
      accountName,
      legalName,
      phone,
      contactEmail,
      taxId,
      address,
      bankName,
      branchName,
      accountType,
      accountNumber,
      payoutMethod,
      promptpayType,
      promptpayId,
      receivingQrImageUrl,
      receivingQrPayload,
      note,
      kycStatus,
      createdAt,
      updatedAt,
    };
  }
}
