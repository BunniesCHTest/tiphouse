import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { DonationStatus, PaymentProvider } from "@prisma/client";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { AlertDeliveryService } from "../overlay/alert-delivery.service";
import { PrismaService } from "../../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertDelivery: AlertDeliveryService,
  ) {}

  private requireAdmin(user: JwtUser) {
    if (user.role !== "ADMIN") throw new ForbiddenException("admin role required");
  }

  private requireStaff(user: JwtUser) {
    if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") throw new ForbiddenException("admin or accounting role required");
  }

  private async importOwner() {
    const passwordHash = await argon2.hash(`system-${Date.now()}-${Math.random()}`);
    return this.prisma.user.upsert({
      where: { username: "__tiphouse_imports" },
      update: {},
      create: {
        username: "__tiphouse_imports",
        email: "imports@tiphouse.local",
        passwordHash,
        role: "USER",
        accountStatus: "APPROVED",
        creatorSetupCompleted: true,
        page: {
          create: {
            slug: "admin-imports",
            displayName: "Admin Imports",
            handle: "@admin-imports",
            minAmount: 1,
            goalAmount: 20000,
            theme: {},
          },
        },
      },
      include: { page: true },
    });
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
      where: {
        username: { not: "__tiphouse_imports" },
        ...(q
          ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { page: { displayName: { contains: q, mode: "insensitive" } } },
              { page: { slug: { contains: q, mode: "insensitive" } } },
            ],
          }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountStatus: true,
        creatorSetupCompleted: true,
        donationNotificationEmail: true,
        createdAt: true,
        updatedAt: true,
        page: {
          select: {
            slug: true,
            displayName: true,
            handle: true,
            minAmount: true,
            goalAmount: true,
          },
        },
      },
    });
    return users.map((item) => {
      const streamlabsLogin = item.email.startsWith("streamlabs-") && item.email.endsWith("@tiphouse.local");
      return {
        ...item,
        authProvider: streamlabsLogin ? "Streamlabs" : "Email",
        streamlabsUsername: streamlabsLogin ? item.username : null,
      };
    });
  }

  @Get("users/:id")
  async userDetail(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    this.requireAdmin(user);
    const item = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { page: true, payout: true, overlay: true },
    });
    const streamlabs = typeof item.overlay?.theme === "object" && item.overlay?.theme ? (item.overlay.theme as any).streamlabs : undefined;
    const payout = item.payout ? {
      ...item.payout,
      slipOkApiKeyEncrypted: undefined,
      slipOkConfigured: Boolean(item.payout.slipOkBranchId && item.payout.slipOkApiKeyEncrypted),
    } : null;
    return {
      ...item,
      payout,
      authProvider: streamlabs?.connected ? "Streamlabs" : "Email",
      streamlabsUsername: streamlabs?.username ?? null,
    };
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
    return {
      ...updated,
      payout: updated.payout ? {
        ...updated.payout,
        slipOkApiKeyEncrypted: undefined,
        slipOkConfigured: Boolean(updated.payout.slipOkBranchId && updated.payout.slipOkApiKeyEncrypted),
      } : null,
    };
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
    const search = q?.trim();
    const rows = await this.prisma.donation.findMany({
      where: {
        userId: userId || undefined,
        paymentStatus: status ? (status as any) : undefined,
        OR: search
          ? [
              { donorName: { contains: search, mode: "insensitive" } },
              { message: { contains: search, mode: "insensitive" } },
              { transactionRef: { contains: search, mode: "insensitive" } },
              { user: { username: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { user: { donationNotificationEmail: { contains: search, mode: "insensitive" } } },
              { page: { slug: { contains: search, mode: "insensitive" } } },
              { page: { displayName: { contains: search, mode: "insensitive" } } },
              { page: { handle: { contains: search, mode: "insensitive" } } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { id: true, username: true, email: true } }, page: { select: { slug: true, displayName: true } } },
    });
    const localRows = rows.map((row) => ({
      ...row,
      source: row.qrPayload === "ADMIN_IMPORT" ? "import" : "tiphouse",
    }));
    if (!search || userId) return localRows;

    const creators = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { donationNotificationEmail: { contains: search, mode: "insensitive" } },
          { page: { slug: { contains: search, mode: "insensitive" } } },
          { page: { displayName: { contains: search, mode: "insensitive" } } },
          { page: { handle: { contains: search, mode: "insensitive" } } },
        ],
      },
      include: { overlay: true, page: true },
      take: 5,
    });
    const streamlabsRows = (await Promise.all(creators.map((creator) => this.streamlabsTransactions(creator)))).flat();
    return [...localRows, ...streamlabsRows]
      .sort((a, b) => new Date(b.paidAt ?? b.createdAt).getTime() - new Date(a.paidAt ?? a.createdAt).getTime())
      .slice(0, 500);
  }

  @Post("transactions/import")
  async importTransactions(@CurrentUser() user: JwtUser, @Body() body: any) {
    this.requireStaff(user);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) throw new ForbiddenException("rows are required");

    const creator = await this.importOwner();
    if (!creator.page) throw new ForbiddenException("Cannot prepare import transaction owner");

    const created: Array<{ id: string }> = [];
    for (const row of rows.slice(0, 300)) {
      const amount = Math.round(Number(row.amount ?? 0));
      if (!Number.isFinite(amount) || amount < 1 || amount > 20000) continue;
      const paidAt = this.parseDate(row.date) ?? new Date();
      const provider = this.paymentProviderFromChannel(row.channel);
      const rawReference = String(row.reference ?? "").trim();
      const baseReference = rawReference || `TH-IMPORT-${Date.now()}-${created.length + 1}`;
      const existingReference = await this.prisma.donation.findUnique({
        where: { transactionRef: baseReference },
        select: { id: true },
      });
      const reference = existingReference ? `${baseReference}-${Date.now()}-${created.length + 1}` : baseReference;
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
          qrPayload: "ADMIN_IMPORT",
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
    if (id.startsWith("streamlabs:")) {
      const [, creatorId, encodedExternalId] = id.split(":");
      const externalId = decodeURIComponent(encodedExternalId ?? "");
      const creator = await this.prisma.user.findUniqueOrThrow({
        where: { id: creatorId },
        include: { overlay: true, page: true },
      });
      const external = (await this.streamlabsTransactions(creator))
        .find((row: any) => row.id === `streamlabs:${creatorId}:${encodeURIComponent(externalId)}`);
      if (!external || !creator.overlay) throw new BadRequestException("Streamlabs transaction not found");
      return this.alertDelivery.deliver(creator.overlay, {
        donationId: external.id,
        donorName: external.donorName,
        amount: external.amount,
        message: external.message,
        anonymous: external.anonymous,
        createdAt: external.paidAt,
      });
    }
    const donation = await this.prisma.donation.findUniqueOrThrow({
      where: { id },
      include: {
        user: { include: { overlay: true } },
        page: { include: { user: { include: { overlay: true } } } },
      },
    });
    const overlay = donation.page.user.overlay ?? donation.user.overlay;
    if (!overlay?.streamerKey) return { ok: false, message: "Creator has no overlay URL" };
    return this.alertDelivery.deliver(overlay, {
      donationId: donation.id,
      donorName: donation.anonymous ? "เธเธธเธเธเธฅเธเธดเธฃเธเธฒเธก" : donation.donorName,
      amount: donation.amount,
      message: donation.message,
      anonymous: donation.anonymous,
      createdAt: donation.paidAt?.toISOString() ?? donation.createdAt.toISOString(),
    });
  }

  private async streamlabsTransactions(creator: any) {
    const streamlabs = creator.overlay?.theme?.streamlabs;
    if (!streamlabs?.connected || !streamlabs?.accessToken || !creator.page) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch("https://streamlabs.com/api/v2.0/donations?limit=100", {
        headers: { Authorization: `Bearer ${streamlabs.accessToken}` },
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const body = await response.json() as any;
      const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
      return items.filter((item: any) => !String(item?.identifier ?? "").startsWith("tiphouse-test")).map((item: any) => {
        const externalId = String(item.donation_id ?? item.id ?? item.transaction_id ?? item.identifier ?? randomUUID());
        const amount = Number(item.amount ?? item.formatted_amount ?? 0);
        const donorName = String(item.name ?? item.from ?? item.donor_name ?? item.username ?? "Anonymous");
        const paidAt = String(item.created_at ?? item.createdAt ?? item.date ?? new Date().toISOString());
        return {
          id: `streamlabs:${creator.id}:${encodeURIComponent(externalId)}`,
          userId: creator.id,
          pageId: creator.page.id,
          donorName,
          message: String(item.message ?? item.note ?? ""),
          amount: Number.isFinite(amount) ? amount : 0,
          anonymous: donorName.toLowerCase() === "anonymous",
          paymentStatus: "PAID",
          paymentProvider: "STREAMLABS",
          transactionRef: item.identifier ? String(item.identifier) : `SL-${externalId}`,
          qrPayload: null,
          paidAt,
          createdAt: paidAt,
          updatedAt: paidAt,
          source: "streamlabs",
          user: { id: creator.id, username: creator.username, email: creator.email },
          page: { slug: creator.page.slug, displayName: creator.page.displayName },
        };
      }).filter((item: any) => item.amount > 0);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  @Delete("transactions/:id")
  async deleteTransaction(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    this.requireStaff(user);
    const donation = await this.prisma.donation.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        userId: true,
        donorName: true,
        amount: true,
        transactionRef: true,
        paymentProvider: true,
        paymentStatus: true,
        createdAt: true,
      },
    });
    await this.prisma.adminLog.create({
      data: {
        adminId: user.sub,
        action: "DELETE_TRANSACTION",
        targetId: donation.id,
        metadata: donation,
      },
    });
    await this.prisma.donation.delete({ where: { id } });
    return { ok: true, deleted: donation };
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
