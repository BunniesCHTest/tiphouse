import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DonationStatus, PaymentProvider, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import * as QRCode from "qrcode";
import Stripe = require("stripe");
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDonationDto, UpdateDonationPageDto } from "./dto";
import { createFixedAmountThaiQr } from "./thai-qr";

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPublicPage(slug: string) {
    const page = await this.prisma.donationPage.findUnique({
      where: { slug },
      include: { user: { include: { overlay: true } } },
    });
    if (!page) throw new NotFoundException("Donation page not found");
    if (page.user.accountStatus !== "APPROVED" || !page.user.creatorSetupCompleted) throw new NotFoundException("Donation page is not active");
    return {
      slug: page.slug,
      displayName: page.displayName,
      handle: page.handle,
      avatarUrl: page.avatarUrl,
      bannerUrl: page.bannerUrl,
      soundUrl: page.soundUrl,
      donationAccountName: page.donationAccountName,
      minAmount: page.minAmount,
      goalAmount: page.goalAmount,
      theme: page.theme,
      overlayKey: page.user.overlay?.streamerKey,
    };
  }

  async latest(slug: string) {
    const page = await this.prisma.donationPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException("Donation page not found");
    return this.prisma.donation.findMany({
      where: { pageId: page.id, paymentStatus: DonationStatus.PAID },
      orderBy: { paidAt: "desc" },
      take: 20,
      select: { donorName: true, amount: true, message: true, anonymous: true, paidAt: true },
    });
  }

  async rank(slug: string) {
    const page = await this.prisma.donationPage.findUnique({ where: { slug }, include: { user: { include: { overlay: true } } } });
    if (!page) throw new NotFoundException("Donation page not found");
    const streamlabsRank = await this.streamlabsTopTips(page.user.overlay?.theme).catch(() => []);
    if (streamlabsRank.length) return streamlabsRank;
    const rows = await this.prisma.donation.groupBy({
      by: ["donorName", "anonymous"],
      where: { pageId: page.id, paymentStatus: DonationStatus.PAID },
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 30,
    });
    const totals = new Map<string, { donorName: string; amount: number; count: number; anonymous: boolean }>();
    for (const row of rows) {
      const anonymous = row.anonymous;
      const donorName = anonymous ? "บุคคลนิรนาม" : row.donorName;
      const current = totals.get(donorName) ?? { donorName, amount: 0, count: 0, anonymous };
      current.amount += row._sum.amount ?? 0;
      current.count += row._count._all;
      current.anonymous = current.anonymous || anonymous;
      totals.set(donorName, current);
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }

  async receipt(ref: string) {
    const donation = await this.prisma.donation.findUnique({
      where: { transactionRef: ref },
      include: { page: { select: { slug: true, displayName: true } } },
    });
    if (!donation) throw new NotFoundException("Receipt not found");
    return {
      reference: donation.transactionRef,
      paymentMethod: donation.paymentProvider,
      createdAt: donation.createdAt,
      paidAt: donation.paidAt,
      status: donation.paymentStatus === DonationStatus.PAID ? "สำเร็จ" : donation.paymentStatus,
      amount: donation.amount,
      donorName: donation.anonymous ? "บุคคลนิรนาม" : donation.donorName,
      message: donation.message,
      page: donation.page,
    };
  }

  private async streamlabsTopTips(theme: unknown) {
    const streamlabs = typeof theme === "object" && theme ? (theme as any).streamlabs : undefined;
    if (!streamlabs?.connected || !streamlabs?.accessToken) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const response = await fetch("https://streamlabs.com/api/v2.0/donations?limit=100", {
      headers: { Authorization: `Bearer ${streamlabs.accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const body = await response.json() as any;
    const donations = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const totals = new Map<string, { donorName: string; amount: number; count: number; anonymous: boolean; source: string }>();
    for (const item of donations) {
      if (this.isTipHouseTestDonation(item)) continue;
      const donorName = String(item.name ?? item.from ?? item.donor_name ?? item.username ?? "Anonymous");
      const amount = Number(item.amount ?? item.formatted_amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const anonymous = donorName.toLowerCase() === "anonymous";
      const key = anonymous ? "บุคคลนิรนาม" : donorName;
      const current = totals.get(key) ?? { donorName: key, amount: 0, count: 0, anonymous, source: "streamlabs" };
      current.amount += amount;
      current.count += 1;
      totals.set(key, current);
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }

  async createPending(dto: CreateDonationDto, meta: { ipAddress?: string; userAgent?: string }) {
    const page = await this.prisma.donationPage.findUnique({
      where: { slug: dto.pageSlug },
      include: { user: { include: { payout: true } } },
    });
    if (!page) throw new NotFoundException("Donation page not found");
    if (page.user.accountStatus !== "APPROVED") throw new BadRequestException("Creator account is waiting for admin approval");
    if (dto.amount < page.minAmount) throw new BadRequestException(`Minimum donation is ${page.minAmount}`);
    if (dto.amount > 20000) throw new BadRequestException("Maximum donation is 20000");

    const transactionRef = `TH${randomBytes(8).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const paymentProvider = this.paymentProvider();
    let donation = await this.prisma.donation.create({
      data: {
        userId: page.userId,
        pageId: page.id,
        donorName: dto.anonymous ? "Anonymous" : dto.donorName,
        message: dto.message,
        amount: dto.amount,
        anonymous: dto.anonymous,
        paymentProvider,
        transactionRef,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    if (paymentProvider === PaymentProvider.STRIPE) {
      try {
        const stripe = this.stripe();
        const intent = await stripe.paymentIntents.create({
          amount: donation.amount * 100,
          currency: "thb",
          payment_method_types: ["promptpay"],
          payment_method_data: {
            type: "promptpay",
            billing_details: {
              email: dto.donorEmail.trim().toLowerCase(),
              name: dto.anonymous ? "Anonymous" : dto.donorName,
            },
          },
          confirm: true,
          description: `TipHouse donation to ${page.displayName}`,
          metadata: {
            transactionRef,
            donationId: donation.id,
            creatorUserId: page.userId,
            pageSlug: page.slug,
          },
        }, {
          idempotencyKey: transactionRef,
        });
        const promptPay = intent.next_action?.type === "promptpay_display_qr_code"
          ? intent.next_action.promptpay_display_qr_code
          : undefined;
        if (!promptPay?.image_url_png) {
          throw new ServiceUnavailableException("Stripe did not return a PromptPay QR Code");
        }
        donation = await this.prisma.donation.update({
          where: { id: donation.id },
          data: {
            providerTransactionId: intent.id,
            qrPayload: promptPay.data,
          },
        });
        return {
          donationId: donation.id,
          transactionRef,
          status: donation.paymentStatus,
          paymentProvider,
          qrPayload: promptPay.data,
          qrDataUrl: promptPay.image_url_png,
          hostedInstructionsUrl: promptPay.hosted_instructions_url,
          qrDisplayName: page.displayName,
          amount: donation.amount,
          createdAt: donation.createdAt,
          expiresAt,
        };
      } catch (error) {
        await this.prisma.donation.updateMany({
          where: { id: donation.id, paymentStatus: DonationStatus.PENDING },
          data: { paymentStatus: DonationStatus.FAILED },
        });
        if (error instanceof ServiceUnavailableException) throw error;
        const stripeError = error as { type?: string; code?: string; message?: string };
        this.logger.error(
          `Stripe PromptPay creation failed (${stripeError.type ?? "unknown"}/${stripeError.code ?? "unknown"}): ${stripeError.message ?? "unknown error"}`,
        );
        if (stripeError.type === "StripeAuthenticationError") {
          throw new ServiceUnavailableException("Stripe Secret Key ไม่ถูกต้องหรือหมดอายุ");
        }
        if (stripeError.type === "StripePermissionError") {
          throw new ServiceUnavailableException("บัญชี Stripe ยังไม่ได้รับสิทธิ์ใช้งาน PromptPay");
        }
        if (stripeError.type === "StripeInvalidRequestError") {
          throw new ServiceUnavailableException(`Stripe ไม่สามารถสร้าง PromptPay ได้: ${stripeError.message ?? stripeError.code ?? "Invalid request"}`);
        }
        throw new ServiceUnavailableException("Unable to create Stripe PromptPay payment");
      }
    }

    const receivingQrPayload = page.user.payout?.receivingQrPayload;
    if (!receivingQrPayload) {
      await this.prisma.donation.update({
        where: { id: donation.id },
        data: { paymentStatus: DonationStatus.FAILED },
      });
      throw new BadRequestException("Creator has not configured a receiving QR Code");
    }
    const qrPayload = createFixedAmountThaiQr(receivingQrPayload, dto.amount, transactionRef);
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 360,
    });
    donation = await this.prisma.donation.update({
      where: { id: donation.id },
      data: { qrPayload },
    });

    return {
      donationId: donation.id,
      transactionRef,
      status: donation.paymentStatus,
      paymentProvider,
      qrPayload,
      qrDataUrl,
      qrDisplayName: page.donationAccountName,
      amount: donation.amount,
      createdAt: donation.createdAt,
      expiresAt,
    };
  }

  private paymentProvider() {
    const configured = this.config.get<string>("PAYMENT_PROVIDER", "STRIPE").trim().toUpperCase();
    if (configured === PaymentProvider.STRIPE) return PaymentProvider.STRIPE;
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new ServiceUnavailableException("PAYMENT_PROVIDER must be STRIPE in production");
    }
    return PaymentProvider.PROMPTPAY;
  }

  private stripe() {
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY")?.trim();
    if (!secretKey) throw new ServiceUnavailableException("STRIPE_SECRET_KEY is not configured");
    return new Stripe(secretKey);
  }

  async paymentStatus(transactionRef: string) {
    const donation = await this.prisma.donation.findUnique({
      where: { transactionRef },
      select: {
        transactionRef: true,
        amount: true,
        paymentStatus: true,
        paymentProvider: true,
        providerTransactionId: true,
        createdAt: true,
        expiresAt: true,
        paidAt: true,
      },
    });
    if (!donation) throw new NotFoundException("Donation transaction not found");
    const expiresAt = donation.expiresAt ?? new Date(donation.createdAt.getTime() + 10 * 60 * 1000);
    const expired = donation.paymentStatus === DonationStatus.PENDING && Date.now() >= expiresAt.getTime();
    if (expired) {
      await this.prisma.donation.updateMany({
        where: { transactionRef, paymentStatus: DonationStatus.PENDING },
        data: { paymentStatus: DonationStatus.EXPIRED },
      });
      if (donation.paymentProvider === PaymentProvider.STRIPE && donation.providerTransactionId) {
        await this.stripe().paymentIntents.cancel(donation.providerTransactionId).catch(() => undefined);
      }
    }
    return {
      transactionRef: donation.transactionRef,
      amount: donation.amount,
      status: expired ? DonationStatus.EXPIRED : donation.paymentStatus,
      createdAt: donation.createdAt,
      paidAt: donation.paidAt,
      expiresAt,
    };
  }

  async markPaid(transactionRef: string) {
    const updated = await this.prisma.donation.updateMany({
      where: { transactionRef, paymentStatus: { not: DonationStatus.PAID } },
      data: { paymentStatus: DonationStatus.PAID, paidAt: new Date() },
    });
    const donation = await this.prisma.donation.findUniqueOrThrow({
      where: { transactionRef },
      include: { user: { include: { overlay: true } } },
    });
    return { ...donation, alreadyProcessed: updated.count === 0 };
  }

  async dashboard(userId: string) {
    await this.ensureApproved(userId);
    const [page, donations, totals] = await Promise.all([
      this.prisma.donationPage.findUnique({ where: { userId } }),
      this.prisma.donation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.donation.aggregate({
        where: { userId, paymentStatus: DonationStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return { page, donations, streamlabsTips: [], revenue: totals._sum.amount ?? 0, donationCount: totals._count };
  }

  async dashboardStreamlabsTips(userId: string) {
    await this.ensureApproved(userId);
    const overlay = await this.prisma.overlaySetting.findUnique({
      where: { userId },
      select: { theme: true },
    });
    return this.streamlabsTips(overlay?.theme).catch(() => []);
  }

  async updatePage(userId: string, dto: UpdateDonationPageDto) {
    await this.ensureApproved(userId);
    const { donationBackgroundUrl, quicklinkUrl, theme, ...pageFields } = dto;
    if (dto.slug) {
      const slug = dto.slug.trim().toLowerCase();
      if (!/^[a-z0-9]{4,30}$/.test(slug)) {
        throw new BadRequestException("Donation URL must be 4-30 lowercase letters or numbers");
      }
      const existing = await this.prisma.donationPage.findUnique({ where: { slug }, select: { userId: true } });
      if (existing && existing.userId !== userId) {
        throw new ConflictException("เนื่องจาก Username นี้มีผู้ใช้งานแล้วรบกวนระบุ Username ใหม่อีกครั้ง");
      }
      pageFields.slug = slug;
    }
    const current = await this.prisma.donationPage.findUnique({ where: { userId }, select: { theme: true } });
    const currentTheme = typeof current?.theme === "object" && current.theme ? current.theme as Record<string, unknown> : {};
    const data: Prisma.DonationPageUpdateInput = {
      ...pageFields,
      theme: {
        ...currentTheme,
        ...(theme ?? {}),
        ...(quicklinkUrl !== undefined ? { quicklinkUrl } : {}),
        ...(donationBackgroundUrl !== undefined ? { donationBackgroundUrl } : {}),
      } as Prisma.InputJsonValue,
    };
    return this.prisma.donationPage.update({ where: { userId }, data });
  }

  private async ensureApproved(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { accountStatus: true } });
    if (user?.accountStatus !== "APPROVED") {
      throw new ForbiddenException("Account is waiting for admin approval");
    }
  }

  private async streamlabsTips(theme: unknown) {
    const streamlabs = typeof theme === "object" && theme ? (theme as any).streamlabs : undefined;
    if (!streamlabs?.connected || !streamlabs?.accessToken) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const response = await fetch("https://streamlabs.com/api/v2.0/donations?limit=100", {
      headers: { Authorization: `Bearer ${streamlabs.accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const body = await response.json() as any;
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return rows.filter((item: any) => !this.isTipHouseTestDonation(item)).map((item: any) => {
      const amount = Number(item.amount ?? item.formatted_amount ?? 0);
      return {
        id: String(item.donation_id ?? item.id ?? item.transaction_id ?? `${item.created_at ?? Date.now()}-${item.name ?? item.from ?? "tip"}`),
        when: item.created_at ?? item.createdAt ?? item.date ?? item.when ?? null,
        tipper: String(item.name ?? item.from ?? item.donor_name ?? item.username ?? "Anonymous"),
        amount: Number.isFinite(amount) ? amount : 0,
        message: String(item.message ?? item.note ?? ""),
        source: "streamlabs",
      };
    }).filter((item: any) => item.amount > 0);
  }

  private isTipHouseTestDonation(item: any) {
    return String(item?.identifier ?? "").startsWith("tiphouse-test");
  }
}
