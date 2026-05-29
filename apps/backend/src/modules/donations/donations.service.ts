import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DonationStatus } from "@prisma/client";
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
    if (page.user.accountStatus !== "APPROVED") throw new NotFoundException("Donation page is waiting for approval");
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

  async createPending(dto: CreateDonationDto, meta: { ipAddress?: string; userAgent?: string }) {
    const page = await this.prisma.donationPage.findUnique({ where: { slug: dto.pageSlug }, include: { user: true } });
    if (!page) throw new NotFoundException("Donation page not found");
    if (page.user.accountStatus !== "APPROVED") throw new BadRequestException("Creator account is waiting for admin approval");
    if (dto.amount < page.minAmount) throw new BadRequestException(`Minimum donation is ${page.minAmount}`);

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
    const [page, donations, totals] = await Promise.all([
      this.prisma.donationPage.findUnique({ where: { userId } }),
      this.prisma.donation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.donation.aggregate({
        where: { userId, paymentStatus: DonationStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return { page, donations, revenue: totals._sum.amount ?? 0, donationCount: totals._count };
  }

  updatePage(userId: string, dto: UpdateDonationPageDto) {
    return this.ensureApproved(userId).then(() =>
      this.prisma.donationPage.update({ where: { userId }, data: dto }),
    );
  }

  private async ensureApproved(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { accountStatus: true } });
    if (user?.accountStatus !== "APPROVED") {
      throw new ForbiddenException("Account is waiting for admin approval");
    }
  }
}
