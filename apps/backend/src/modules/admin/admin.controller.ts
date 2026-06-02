import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { PrismaService } from "../../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  private requireAdmin(user: JwtUser) {
    if (user.role !== "ADMIN") throw new ForbiddenException("admin role required");
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
    for (const key of ["username", "email", "role", "accountStatus", "pendingEmail"]) {
      if (body[key] !== undefined) userData[key] = body[key];
    }
    const pageData: any = {};
    for (const key of ["slug", "displayName", "handle", "donationAccountName", "minAmount", "goalAmount"]) {
      if (body.page?.[key] !== undefined) pageData[key] = body.page[key];
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

  @Get("transactions")
  async transactions(
    @CurrentUser() user: JwtUser,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("userId") userId?: string,
  ) {
    this.requireAdmin(user);
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

  @Get("transactions/user/:id")
  async userTransactions(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    this.requireAdmin(user);
    return this.prisma.donation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      include: { page: { select: { slug: true, displayName: true } } },
    });
  }

  @Get("approvals")
  async approvals(@CurrentUser() user: JwtUser, @Query("status") status?: string) {
    this.requireAdmin(user);
    return this.prisma.approvalRequest.findMany({
      where: { status: status ? (status as any) : undefined },
      orderBy: { createdAt: "desc" },
      include: { user: { include: { page: true } } },
    });
  }

  @Post("approvals/:id/approve")
  async approve(@CurrentUser() admin: JwtUser, @Param("id") id: string) {
    this.requireAdmin(admin);
    const request = await this.prisma.approvalRequest.findUniqueOrThrow({ where: { id }, include: { user: true } });
    if (request.type === "REGISTER") {
      await this.prisma.user.update({ where: { id: request.userId }, data: { accountStatus: "APPROVED" } });
    }
    if (request.type === "EMAIL_CHANGE" && request.requestedEmail) {
      await this.prisma.user.update({
        where: { id: request.userId },
        data: { email: request.requestedEmail, pendingEmail: null },
      });
    }
    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: admin.sub, reviewedAt: new Date() },
    });
    await this.prisma.adminLog.create({ data: { adminId: admin.sub, action: "APPROVE_REQUEST", targetId: id } });
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
    await this.prisma.adminLog.create({ data: { adminId: admin.sub, action: "REJECT_REQUEST", targetId: id } });
    return updated;
  }
}
