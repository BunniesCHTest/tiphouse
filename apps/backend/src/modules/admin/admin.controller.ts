import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { PrismaService } from "../../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("overview")
  async overview(@CurrentUser() user: JwtUser) {
    if (user.role !== "ADMIN") return { ok: false, reason: "admin role required" };
    const [users, donations, webhookLogs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.donation.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.prisma.webhookLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return { users, donations, webhookLogs };
  }
}
