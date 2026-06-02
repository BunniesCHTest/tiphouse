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
    const candidates = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { in: ["AdminC", "Test"] } },
          { email: "admin@tiphouse.test" },
        ],
      },
      select: { id: true, username: true, email: true },
    });
    const existing =
      candidates.find((item) => item.email === "admin@tiphouse.test") ??
      candidates.find((item) => item.username === "AdminC") ??
      candidates.find((item) => item.username === "Test");

    if (existing) {
      const archiveTargets = candidates.filter((item) => item.id !== existing.id);
      for (const target of archiveTargets) {
        const suffix = target.id.slice(0, 8);
        await this.prisma.user.update({
          where: { id: target.id },
          data: {
            username: `${target.username || "admin"}-archived-${suffix}`.slice(0, 50),
            email: `archived-${suffix}-${Date.now()}@tiphouse.local`,
          },
        });
      }
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: "AdminC",
          email: "admin@tiphouse.test",
          passwordHash,
          role: UserRole.ADMIN,
          accountStatus: "APPROVED",
          passwordMustChange: false,
          creatorSetupCompleted: true,
        },
      });
      return;
    }
    await this.prisma.user.create({
      data: {
        username: "AdminC",
        email: "admin@tiphouse.test",
        passwordHash,
        role: UserRole.ADMIN,
        accountStatus: "APPROVED",
        passwordMustChange: false,
        creatorSetupCompleted: true,
      },
    });
  }
}
