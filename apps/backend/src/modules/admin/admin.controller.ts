import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { DonationStatus, PaymentProvider } from "@prisma/client";
import * as argon2 from "argon2";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { OverlayService } from "../overlay/overlay.service";
import { PrismaService } from "../../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overlay: OverlayService,
  ) {}

  private requireAdmin(user: JwtUser) {
    if (user.role !== "ADMIN") throw new ForbiddenException("admin role required");
  }

  private requireStaff(user: JwtUser) {
    if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") throw new ForbiddenException("admin or accounting role required");
  }

  @Get("overview")
  async overview(@CurrentUser() user: JwtUser) {
    this.requireAdmin(user);
    const [users, donations, webhookLogs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.donation.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.prisma.webhookLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return { users, donations, webhookLogs };
  }

  @Get("users")
  async users(@CurrentUser() user: JwtUser, @Query("q") q?: string) {
    this.requireAdmin(user);
    const users = await this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { page: { displayName: { contains: q, mode: "insensitive" } } },
              { page: { slug: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: { page: true, payout: true, overlay: true, _count: { select: { donations: true, approvals: true } } },
    });
    return users.map((item) => {
      const streamlabs = typeof item.overlay?.theme === "object" && item.overlay?.theme ? (item.overlay.theme as any).streamlabs : undefined;
      return {
        ...item,
        authProvider: streamlabs?.connected ? "Streamlabs" : "Email",
        streamlabsUsername: streamlabs?.username ?? null,
      };
    });
  }

  @Patch("users/:id")
  async updateUser(@CurrentUser() admin: JwtUser, @Param("id") id: string, @Body() body: any) {
    this.requireAdmin(admin);
    const userData: any = {};
    for (const key of ["username", "email", "role", "accountStatus", "donationNotificationEmail", "creatorSetupCompleted"]) {
      if (body[key] !== undefined) userData[key] = body[key];
    }
    const pageData: any = {};
    for (const key of ["slug", "displayName", "handle", "donationAccountName", "minAmount", "goalAmount"]) {
      if (body.page?.[key] !== undefined) pageData[key] = body.page[key];
    }
    if (pageData.slug !== undefined) {
      const slug = String(pageData.slug ?? "").trim().toLowerCase();
      if (!/^[a-z0-9]{4,30}$/.test(slug)) {
        throw new BadRequestException("Donation URL must be 4-30 lowercase letters or numbers");
      }
      pageData.slug = slug;
    }
    if (pageData.displayName !== undefined) {
      pageData.displayName = String(pageData.displayName ?? "").trim().slice(0, 30);
      if (!pageData.displayName) throw new BadRequestException("Display name is required");
    }
    if (pageData.handle !== undefined) {
      pageData.handle = String(pageData.handle ?? "").trim().slice(0, 30);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        page: Object.keys(pageData).length ? { update: pageData } : undefined,
      },
      include: { page: true, payout: true, overlay: true },
    });
    await this.prisma.adminLog.create({
      data: { adminId: admin.sub, action: "UPDATE_USER", targetId: id, metadata: { fields: Object.keys(body) } },
    });
    return updated;
  }

  @Delete("users/:id")
  async deleteUser(@CurrentUser() admin: JwtUser, @Param("id") id: string) {
    this.requireAdmin(admin);
    if (admin.sub === id) throw new ForbiddenException("Cannot delete your own admin account");
    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, username: true, email: true, role: true },
    });
    if (target.role === "ADMIN") {
      const adminCount = await this.prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) throw new ForbiddenException("Cannot delete the last admin account");
    }
    await this.prisma.adminLog.create({
      data: { adminId: admin.sub, action: "DELETE_USER", targetId: id, metadata: { username: target.username, email: target.email, role: target.role } },
    });
    await this.prisma.user.delete({ where: { id } });
    return { ok: true, deleted: target };
  }

  @Get("transactions")
  async transactions(
    @CurrentUser() user: JwtUser,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("userId") userId?: string,
  ) {
    this.requireStaff(user);
    return this.prisma.donation.findMany({
      where: {
        userId: userId || undefined,
        paymentStatus: status ? (status as any) : undefined,
        OR: q
          ? [
              { donorName: { contains: q, mode: "insensitive" } },
              { message: { contains: q, mode: "insensitive" } },
              { transactionRef: { contains: q, mode: "insensitive" } },
              { user: { username: { contains: q, mode: "insensitive" } } },
              { page: { slug: { contains: q, mode: "insensitive" } } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { id: true, username: true, email: true } }, page: { select: { slug: true, displayName: true } } },
    });
  }

  @Post("transactions/import")
  async importTransactions(@CurrentUser() user: JwtUser, @Body() body: any) {
    this.requireStaff(user);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) throw new ForbiddenException("rows are required");

    const creator = await this.prisma.user.findFirst({
      where: {
        role: "USER",
        accountStatus: "APPROVED",
        creatorSetupCompleted: true,
        page: { isNot: null },
      },
      include: { page: true },
      orderBy: { createdAt: "desc" },
    });
    if (!creator?.page) throw new ForbiddenException("ยังไม่มี Creator ที่พร้อมรับ transaction import");

    const created: Array<{ id: string }> = [];
    for (const row of rows.slice(0, 300)) {
      const amount = Math.round(Number(row.amount ?? 0));
      if (!Number.isFinite(amount) || amount < 1 || amount > 20000) continue;
      const paidAt = this.parseDate(row.date) ?? new Date();
      const provider = this.paymentProviderFromChannel(row.channel);
      const reference: string = String(row.reference ?? "").trim() || `TH-IMPORT-${Date.now()}-${created.length + 1}`;
      const donation = await this.prisma.donation.create({
        data: {
          userId: creator.id,
          pageId: creator.page.id,
          donorName: String(row.name ?? "Anonymous").trim().slice(0, 80) || "Anonymous",
          message: String(row.message ?? "").trim().slice(0, 250),
          amount,
          anonymous: false,
          paymentStatus: DonationStatus.PAID,
          paymentProvider: provider,
          transactionRef: reference,
          paidAt,
          createdAt: paidAt,
        },
      });
      created.push(donation);
    }
    return { imported: created.length, rows: created };
  }

  @Post("transactions/:id/replay-alert")
  async replayAlert(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    this.requireStaff(user);
    const donation = await this.prisma.donation.findUniqueOrThrow({
      where: { id },
      include: {
        user: { include: { overlay: true } },
        page: { include: { user: { include: { overlay: true } } } },
      },
    });
    const overlay = donation.page.user.overlay ?? donation.user.overlay;
    if (!overlay?.streamerKey) return { ok: false, message: "Creator has no overlay URL" };
    this.overlay.emitPaidDonation(overlay.streamerKey, {
      donorName: donation.anonymous ? "บุคคลนิรนาม" : donation.donorName,
      amount: donation.amount,
      message: donation.message,
      anonymous: donation.anonymous,
      settings: {
        theme: overlay.theme,
        animation: overlay.animation,
        soundUrl: overlay.soundUrl,
        ttsEnabled: overlay.ttsEnabled,
      },
    });
    return { ok: true };
  }

  @Get("transactions/user/:id")
  async userTransactions(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    this.requireStaff(user);
    return this.prisma.donation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      include: { page: { select: { slug: true, displayName: true } } },
    });
  }

  @Post("users")
  async createStaffUser(@CurrentUser() admin: JwtUser, @Body() body: any) {
    this.requireAdmin(admin);
    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "ADMIN").toUpperCase();
    if (!username || !email) throw new ForbiddenException("username and email are required");
    if (!["ADMIN", "ACCOUNTING"].includes(role)) throw new ForbiddenException("role must be ADMIN or ACCOUNTING");
    const tempPassword = "Abc@1234";
    const created = await this.prisma.user.create({
      data: {
        username,
        email,
        role: role as any,
        accountStatus: "APPROVED",
        passwordMustChange: true,
        creatorSetupCompleted: true,
        passwordHash: await argon2.hash(tempPassword),
      },
      select: { id: true, username: true, email: true, role: true, accountStatus: true, createdAt: true },
    });
    await this.prisma.adminLog.create({
      data: { adminId: admin.sub, action: "CREATE_STAFF_USER", targetId: created.id, metadata: { role } },
    });
    return { user: created, tempPassword };
  }

  @Post("users/:id/reset-password")
  async resetStaffPassword(@CurrentUser() admin: JwtUser, @Param("id") id: string) {
    this.requireAdmin(admin);
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.role !== "ADMIN" && target.role !== "ACCOUNTING") {
      throw new ForbiddenException("Only ADMIN and ACCOUNTING passwords can be reset here");
    }
    const tempPassword = "Abc@1234";
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(tempPassword),
        passwordMustChange: true,
      },
    });
    await this.prisma.adminLog.create({
      data: { adminId: admin.sub, action: "RESET_STAFF_PASSWORD", targetId: id },
    });
    return { ok: true, tempPassword };
  }

  @Get("approvals")
  async approvals(@CurrentUser() user: JwtUser, @Query("status") status?: string) {
    this.requireAdmin(user);
    const rows = await this.prisma.approvalRequest.findMany({
      where: { status: status ? (status as any) : undefined },
      orderBy: { createdAt: "desc" },
      include: { user: { include: { page: true } } },
    });
    const reviewerIds = [...new Set(rows.map((row) => row.reviewedBy).filter(Boolean) as string[])];
    const reviewers = reviewerIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, username: true, email: true } })
      : [];
    const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
    return rows.map((row) => ({ ...row, reviewer: row.reviewedBy ? reviewerMap.get(row.reviewedBy) ?? null : null }));
  }

  @Post("approvals/:id/approve")
  async approve(@CurrentUser() admin: JwtUser, @Param("id") id: string) {
    this.requireAdmin(admin);
    const request = await this.prisma.approvalRequest.findUniqueOrThrow({ where: { id }, include: { user: true } });
    if (request.type === "REGISTER") {
      await this.prisma.user.update({ where: { id: request.userId }, data: { accountStatus: "APPROVED" } });
    }
    if (request.type === "EMAIL_CHANGE") {
      const detail = this.parseApprovalNote(request.note);
      const data: any = { pendingEmail: null };
      if (detail.newUsername) {
        const existing = await this.prisma.user.findUnique({ where: { username: String(detail.newUsername) }, select: { id: true } });
        if (existing && existing.id !== request.userId) throw new ConflictException("Username already exists");
        data.username = String(detail.newUsername);
        data.page = { update: { handle: `@${detail.newUsername}` } };
      }
      if (detail.newEmail || request.requestedEmail) {
        const email = String(detail.newEmail ?? request.requestedEmail).toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (existing && existing.id !== request.userId) throw new ConflictException("Email already exists");
        data.email = email;
        data.donationNotificationEmail = email;
      }
      await this.prisma.user.update({ where: { id: request.userId }, data });
    }
    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: admin.sub, reviewedAt: new Date() },
    });
    await this.prisma.adminLog.create({ data: { adminId: admin.sub, action: "APPROVE_REQUEST", targetId: id, metadata: { note: request.note } } });
    return updated;
  }

  @Post("approvals/:id/reject")
  async reject(@CurrentUser() admin: JwtUser, @Param("id") id: string) {
    this.requireAdmin(admin);
    const request = await this.prisma.approvalRequest.findUniqueOrThrow({ where: { id } });
    if (request.type === "EMAIL_CHANGE") {
      await this.prisma.user.update({ where: { id: request.userId }, data: { pendingEmail: null } });
    }
    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedBy: admin.sub, reviewedAt: new Date() },
    });
    await this.prisma.adminLog.create({ data: { adminId: admin.sub, action: "REJECT_REQUEST", targetId: id, metadata: { note: request.note } } });
    return updated;
  }

  private parseApprovalNote(note?: string | null) {
    try {
      return note ? JSON.parse(note) as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private parseDate(value: unknown) {
    if (!value) return null;
    if (typeof value === "number") {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
      return excelEpoch;
    }
    const text = String(value).trim();
    const thaiMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (thaiMatch) {
      const [, day, month, year, hour = "0", minute = "0"] = thaiMatch;
      const normalizedYear = Number(year) > 2400 ? Number(year) - 543 : Number(year);
      return new Date(normalizedYear, Number(month) - 1, Number(day), Number(hour), Number(minute));
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private paymentProviderFromChannel(value: unknown) {
    const channel = String(value ?? "").toLowerCase();
    if (channel.includes("omise")) return PaymentProvider.OMISE;
    if (channel.includes("gb")) return PaymentProvider.GBPRIMEPAY;
    if (channel.includes("stripe")) return PaymentProvider.STRIPE;
    return PaymentProvider.PROMPTPAY;
  }
}
