import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import Redis from "ioredis";
import { AuthController } from "./auth.controller";
import { AUTH_REDIS } from "./auth.constants";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: AUTH_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>("REDIS_URL"), {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      }),
    },
  ],
})
export class AuthModule {}
