import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DonationStatus, Prisma } from "@prisma/client";
import QRCode from "qrcode";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDonationDto, UpdateDonationPageDto } from "./dto";

@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const response = await fetch("https://streamlabs.com/api/v2.0/donations?limit=100", {
      headers: { Authorization: `Bearer ${streamlabs.accessToken}` },
    });
    if (!response.ok) return [];
    const body = await response.json() as any;
    const donations = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const totals = new Map<string, { donorName: string; amount: number; count: number; anonymous: boolean; source: string }>();
    for (const item of donations) {
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
    const page = await this.prisma.donationPage.findUnique({ where: { slug: dto.pageSlug }, include: { user: true } });
    if (!page) throw new NotFoundException("Donation page not found");
    if (page.user.accountStatus !== "APPROVED") throw new BadRequestException("Creator account is waiting for admin approval");
    if (dto.amount < page.minAmount) throw new BadRequestException(`Minimum donation is ${page.minAmount}`);
    if (dto.amount > 20000) throw new BadRequestException("Maximum donation is 20000");

    const transactionRef = `TH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const qrPayload = `TIPHOUSE|${page.donationAccountName}|${dto.amount}|${transactionRef}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    const donation = await this.prisma.donation.create({
      data: {
        userId: page.userId,
        pageId: page.id,
        donorName: dto.anonymous ? "Anonymous" : dto.donorName,
        message: dto.message,
        amount: dto.amount,
        anonymous: dto.anonymous,
        paymentProvider: dto.provider,
        transactionRef,
        qrPayload,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      donationId: donation.id,
      transactionRef,
      status: donation.paymentStatus,
      qrPayload,
      qrDataUrl,
      qrDisplayName: page.donationAccountName,
    };
  }

  async markPaid(transactionRef: string) {
    return this.prisma.donation.update({
      where: { transactionRef },
      data: { paymentStatus: DonationStatus.PAID, paidAt: new Date() },
      include: { user: { include: { overlay: true } } },
    });
  }

  async dashboard(userId: string) {
    await this.ensureApproved(userId);
    const [page, overlay, donations, totals] = await Promise.all([
      this.prisma.donationPage.findUnique({ where: { userId } }),
      this.prisma.overlaySetting.findUnique({ where: { userId } }),
      this.prisma.donation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.donation.aggregate({
        where: { userId, paymentStatus: DonationStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    const streamlabsTips = await this.streamlabsTips(overlay?.theme).catch(() => []);
    return { page, donations, streamlabsTips, revenue: totals._sum.amount ?? 0, donationCount: totals._count };
  }

  async updatePage(userId: string, dto: UpdateDonationPageDto) {
    await this.ensureApproved(userId);
    const { quicklinkUrl, theme, ...pageFields } = dto;
    if (dto.slug) {
      const slug = dto.slug.trim().toLowerCase();
      if (!/^[a-z0-9]{4,20}$/.test(slug)) {
        throw new BadRequestException("Donation URL must be 4-20 lowercase letters or numbers");
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
    const response = await fetch("https://streamlabs.com/api/v2.0/donations?limit=100", {
      headers: { Authorization: `Bearer ${streamlabs.accessToken}` },
    });
    if (!response.ok) return [];
    const body = await response.json() as any;
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return rows.map((item: any) => {
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
}
