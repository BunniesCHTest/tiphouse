import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "./prisma/prisma.service";

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.ensureAdminUser();
  }

  private async ensureAdminUser() {
    const passwordHash = await argon2.hash("Abc@1234");
    const [byUsername, byEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { username: "Test" }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email: "admin@tiphouse.test" }, select: { id: true } }),
    ]);
    const existing = byEmail ?? byUsername;
    if (byUsername && byEmail && byUsername.id !== byEmail.id) {
      await this.prisma.user.update({
        where: { id: byUsername.id },
        data: { username: `Test-archived-${byUsername.id.slice(0, 8)}` },
      });
    }
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: "Test",
          email: "admin@tiphouse.test",
          passwordHash,
          role: UserRole.ADMIN,
          accountStatus: "APPROVED",
          passwordMustChange: false,
        },
      });
      return;
    }
    await this.prisma.user.create({
      data: {
        username: "Test",
        email: "admin@tiphouse.test",
        passwordHash,
        role: UserRole.ADMIN,
        accountStatus: "APPROVED",
        passwordMustChange: false,
      },
    });
  }
}
