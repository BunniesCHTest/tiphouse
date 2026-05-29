import { PrismaClient, UserRole } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("password123");
  const user = await prisma.user.upsert({
    where: { email: "creator@tiphouse.test" },
    update: {},
    create: {
      username: "bunniesch",
      email: "creator@tiphouse.test",
      passwordHash,
      role: UserRole.USER,
      accountStatus: "APPROVED",
    },
  });

  await prisma.donationPage.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      slug: "bunniesch",
      displayName: "Bunnie SCH",
      handle: "@bunniesch",
      bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30",
      donationAccountName: "Bunnie SCH Donate",
      minAmount: 20,
      goalAmount: 5000,
      theme: { name: "Aurora Mint", accent: "#38e2c2" },
    },
  });

  await prisma.overlaySetting.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      streamerKey: "abc123",
      animation: { name: "Neon Glow", position: "center", duration: 7 },
      ttsEnabled: true,
      theme: { name: "Neon Glow" },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@tiphouse.test" },
    update: {},
    create: {
      username: "Test",
      email: "admin@tiphouse.test",
      passwordHash: await argon2.hash("Abc@1234"),
      role: UserRole.ADMIN,
      accountStatus: "APPROVED",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
