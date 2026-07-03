import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./modules/admin/admin.module";
import { BootstrapService } from "./bootstrap.service";
import { AuthModule } from "./modules/auth/auth.module";
import { DonationsModule } from "./modules/donations/donations.module";
import { HealthModule } from "./modules/health/health.module";
import { OverlayModule } from "./modules/overlay/overlay.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>("REDIS_URL") },
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    DonationsModule,
    PaymentsModule,
    OverlayModule,
    SettingsModule,
    AdminModule,
  ],
  providers: [
    BootstrapService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
