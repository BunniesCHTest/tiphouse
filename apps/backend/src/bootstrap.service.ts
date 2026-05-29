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
    await this.prisma.user.upsert({
      where: { username: "Test" },
      update: {
        role: UserRole.ADMIN,
        accountStatus: "APPROVED",
      },
      create: {
        username: "Test",
        email: "admin@tiphouse.test",
        passwordHash,
        role: UserRole.ADMIN,
        accountStatus: "APPROVED",
      },
    });
  }
}
