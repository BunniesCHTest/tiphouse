import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import type { Response } from "express";
import Redis from "ioredis";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AUTH_REDIS } from "./auth.constants";
import { ChangePasswordDto, ConfirmPasswordResetDto, LoginDto, RegisterDto, RequestPasswordResetDto } from "./dto";

type StreamlabsTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type StreamlabsUserResponse = Record<string, any>;
type StreamlabsOAuthState = {
  mode: "login" | "connect";
  userId?: string;
};

type StreamlabsLoginExchange = {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    accountStatus: string;
    creatorSetupCompleted: boolean;
  };
  tokens: { accessToken: string; refreshToken: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly pendingStreamlabsLogins = new Map<string, { expiresAt: number; payload: StreamlabsLoginExchange }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(AUTH_REDIS) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          accountStatus: "PENDING",
          page: {
            create: {
              slug: dto.slug,
              displayName: dto.displayName,
              handle: `@${dto.username}`,
              theme: { name: "Aurora Mint", accent: "#38e2c2" },
            },
          },
          overlay: { create: { theme: { name: "Neon Glow" }, animation: { position: "center", duration: 7 } } },
          approvals: { create: { type: "REGISTER", note: "New account registration" } },
        },
        select: { id: true, email: true, username: true, role: true, accountStatus: true },
      });
      return { user, tokens: await this.signTokens(user.id, user.email, user.role) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "username, email, or slug";
        throw new ConflictException(`ข้อมูลซ้ำในระบบ: ${target}`);
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email?.trim().toLowerCase();
    const username = dto.username?.trim();
    const user = email
      ? await this.prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
      : username
        ? await this.prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } })
        : null;
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role, accountStatus: user.accountStatus, passwordMustChange: user.passwordMustChange, creatorSetupCompleted: user.creatorSetupCompleted },
      tokens: await this.signTokens(user.id, user.email, user.role),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException("New password and confirmation do not match");
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, dto.oldPassword))) {
      throw new UnauthorizedException("Old password is incorrect");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(dto.newPassword),
        passwordMustChange: false,
      },
    });
    return { ok: true };
  }

  streamlabsLoginUrl(userId?: string) {
    const clientId = this.config.get<string>("STREAMLABS_CLIENT_ID");
    const clientSecret = this.config.get<string>("STREAMLABS_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("STREAMLABS_REDIRECT_URI");
    const missing = [
      !clientId ? "STREAMLABS_CLIENT_ID" : null,
      !clientSecret ? "STREAMLABS_CLIENT_SECRET" : null,
      !redirectUri ? "STREAMLABS_REDIRECT_URI" : null,
    ].filter(Boolean);
    if (missing.length) {
      return { configured: false, url: null, message: "Streamlabs OAuth is not configured", missing };
    }
    const configuredClientId = clientId as string;
    const configuredRedirectUri = redirectUri as string;
    const state = this.signStreamlabsState(userId ? { mode: "connect", userId } : { mode: "login" });
    const url = new URL("https://streamlabs.com/api/v2.0/authorize");
    url.searchParams.set("client_id", configuredClientId);
    url.searchParams.set("redirect_uri", configuredRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "donations.create donations.read alerts.create socket.token");
    url.searchParams.set("state", state);
    return { configured: true, url: url.toString() };
  }

  async streamlabsCallback(code: string, state: string | undefined, res: Response) {
    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://127.0.0.1:3000");
    try {
      if (!code) throw new UnauthorizedException("Missing Streamlabs authorization code");
      const oauthState = await this.verifyStreamlabsState(state);
      const token = await this.exchangeStreamlabsCode(code);
      const streamlabsUser = await this.fetchStreamlabsUser(token.access_token);
      if (oauthState.mode === "connect" && oauthState.userId) {
        await this.connectStreamlabsToUser(oauthState.userId, streamlabsUser, token);
        const redirect = new URL("/settings/overlay", frontendUrl);
        redirect.searchParams.set("streamlabs", "connected");
        return res.redirect(redirect.toString());
      }
      const user = await this.upsertStreamlabsUser(streamlabsUser, token);
      const tokens = await this.signTokens(user.id, user.email, user.role);
      const exchangeCode = await this.createStreamlabsExchangeCode({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          accountStatus: user.accountStatus,
          creatorSetupCompleted: Boolean(user.creatorSetupCompleted),
        },
        tokens,
      });
      const redirect = new URL("/streamlabs/callback", frontendUrl);
      redirect.searchParams.set("code", exchangeCode);
      return res.redirect(redirect.toString());
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Streamlabs login failed";
      this.logger.error(`Streamlabs OAuth callback failed: ${reason}`);
      const redirect = new URL("/login", frontendUrl);
      redirect.searchParams.set("streamlabs", "failed");
      redirect.searchParams.set("reason", this.publicStreamlabsError(reason));
      return res.redirect(redirect.toString());
    }
  }

  async exchangeStreamlabsLogin(code: string) {
    if (!code) throw new UnauthorizedException("Missing Streamlabs login code");
    const redisKey = this.streamlabsExchangeKey(code);
    try {
      const pipeline = this.redis.multi();
      pipeline.get(redisKey);
      pipeline.del(redisKey);
      const results = await pipeline.exec();
      const serialized = results?.[0]?.[1];
      if (typeof serialized === "string") {
        return JSON.parse(serialized) as StreamlabsLoginExchange;
      }
    } catch (error) {
      this.logger.warn(`Redis Streamlabs exchange read failed: ${error instanceof Error ? error.message : "unknown"}`);
    }

    const entry = this.pendingStreamlabsLogins.get(code);
    this.pendingStreamlabsLogins.delete(code);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException("Invalid or expired Streamlabs login code");
    }
    return entry.payload;
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return { ok: true, message: "If this email exists, reset instructions will be created." };
    const token = randomBytes(24).toString("hex");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashResetToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return {
      ok: true,
      message: "Password reset token created. Connect email delivery before public launch.",
      resetToken: token,
    };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const tokenHash = this.hashResetToken(dto.token);
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await argon2.hash(dto.password), passwordMustChange: false },
      }),
      this.prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  private async exchangeStreamlabsCode(code: string): Promise<StreamlabsTokenResponse> {
    const clientId = this.config.getOrThrow<string>("STREAMLABS_CLIENT_ID");
    const clientSecret = this.config.getOrThrow<string>("STREAMLABS_CLIENT_SECRET");
    const redirectUri = this.config.getOrThrow<string>("STREAMLABS_REDIRECT_URI");
    const response = await fetch("https://streamlabs.com/api/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new UnauthorizedException(`Streamlabs token exchange failed (${response.status}) ${body.slice(0, 180)}`);
    }
    return response.json() as Promise<StreamlabsTokenResponse>;
  }

  private async fetchStreamlabsUser(accessToken: string): Promise<StreamlabsUserResponse> {
    const response = await fetch("https://streamlabs.com/api/v2.0/user", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new UnauthorizedException(`Streamlabs user lookup failed (${response.status}) ${body.slice(0, 180)}`);
    }
    return response.json() as Promise<StreamlabsUserResponse>;
  }

  private async upsertStreamlabsUser(streamlabsUser: StreamlabsUserResponse, token: StreamlabsTokenResponse) {
    const streamlabsId = String(streamlabsUser.id ?? streamlabsUser.streamlabs?.id ?? streamlabsUser.user?.id ?? streamlabsUser.username ?? streamlabsUser.display_name ?? "unknown");
    const displayName = String(streamlabsUser.display_name ?? streamlabsUser.name ?? streamlabsUser.username ?? streamlabsUser.channel ?? `streamlabs-${streamlabsId}`);
    const usernameBase = this.slugify(String(streamlabsUser.username ?? displayName ?? `streamlabs-${streamlabsId}`));
    const email = this.extractEmail(streamlabsUser) ?? `streamlabs-${streamlabsId}@tiphouse.local`;
    const existing = await this.findStreamlabsUser(streamlabsId, email);

    if (existing) {
      const overlay = existing.overlay;
      const updatedOverlay = await this.prisma.overlaySetting.upsert({
        where: { userId: existing.id },
        update: { theme: this.streamlabsTheme(streamlabsUser, token, overlay?.theme) as Prisma.InputJsonValue },
        create: { userId: existing.id, theme: this.streamlabsTheme(streamlabsUser, token, {}) as Prisma.InputJsonValue, animation: { position: "Center", durationSeconds: 7 } },
        include: { user: true },
      });
      return updatedOverlay.user;
    }

    const username = await this.uniqueUsername(usernameBase || `streamlabs-${streamlabsId}`);
    const slug = await this.uniqueSlug(username);
    const created = await this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash: await argon2.hash(randomBytes(32).toString("hex")),
        accountStatus: "APPROVED",
        creatorSetupCompleted: false,
        page: {
          create: {
            slug,
            displayName,
            handle: `@${username}`,
            theme: { name: "Aurora Mint", accent: "#38e2c2" },
          },
        },
        overlay: {
          create: {
            theme: this.streamlabsTheme(streamlabsUser, token, {}),
            animation: { position: "Center", durationSeconds: 7 },
          },
        },
      },
    });
    return { ...created, creatorSetupCompleted: false, onboardingRequired: true };
  }

  private async connectStreamlabsToUser(userId: string, streamlabsUser: StreamlabsUserResponse, token: StreamlabsTokenResponse) {
    const current = await this.prisma.overlaySetting.findUnique({ where: { userId } });
    await this.prisma.overlaySetting.upsert({
      where: { userId },
      update: { theme: this.streamlabsTheme(streamlabsUser, token, current?.theme) as Prisma.InputJsonValue },
      create: {
        userId,
        theme: this.streamlabsTheme(streamlabsUser, token, {}) as Prisma.InputJsonValue,
        animation: { position: "Center", durationSeconds: 7 },
      },
    });
  }

  private streamlabsTheme(streamlabsUser: StreamlabsUserResponse, token: StreamlabsTokenResponse, currentTheme: unknown) {
    const current = typeof currentTheme === "object" && currentTheme ? currentTheme as Record<string, any> : {};
    const streamlabsId = String(streamlabsUser.id ?? streamlabsUser.streamlabs?.id ?? streamlabsUser.user?.id ?? streamlabsUser.username ?? streamlabsUser.display_name ?? "unknown");
    const displayName = String(streamlabsUser.display_name ?? streamlabsUser.name ?? streamlabsUser.username ?? streamlabsUser.channel ?? `streamlabs-${streamlabsId}`);
    return this.cleanJson({
      ...current,
      streamlabs: {
        ...(typeof current.streamlabs === "object" && current.streamlabs ? current.streamlabs : {}),
        connected: true,
        alertBoxEnabled: typeof current.streamlabs?.alertBoxEnabled === "boolean" ? current.streamlabs.alertBoxEnabled : false,
        userId: streamlabsId,
        username: displayName,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenType: token.token_type ?? "Bearer",
        connectedAt: new Date().toISOString(),
      },
    });
  }

  private async findStreamlabsUser(streamlabsId: string, email: string) {
    const byEmail = await this.prisma.user.findUnique({ where: { email }, include: { overlay: true } });
    if (byEmail) return byEmail;
    const byStreamlabsId = await this.prisma.overlaySetting.findFirst({
      where: {
        theme: {
          path: ["streamlabs", "userId"],
          equals: streamlabsId,
        },
      },
      include: {
        user: {
          include: { overlay: true },
        },
      },
    });
    return byStreamlabsId?.user ?? null;
  }

  private extractEmail(streamlabsUser: StreamlabsUserResponse) {
    const candidate = streamlabsUser.email ?? streamlabsUser.user?.email ?? streamlabsUser.streamlabs?.email;
    return typeof candidate === "string" && candidate.includes("@") ? candidate : null;
  }

  private async uniqueUsername(base: string) {
    let candidate = base.slice(0, 40) || "streamlabs";
    for (let index = 0; index < 20; index += 1) {
      const exists = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!exists) return candidate;
      candidate = `${base.slice(0, 34)}${index + 1}`;
    }
    return `${base.slice(0, 30)}${randomBytes(3).toString("hex")}`;
  }

  private async uniqueSlug(base: string) {
    let candidate = base.slice(0, 90) || "streamlabs";
    for (let index = 0; index < 20; index += 1) {
      const exists = await this.prisma.donationPage.findUnique({ where: { slug: candidate } });
      if (!exists) return candidate;
      candidate = `${base.slice(0, 84)}-${index + 1}`;
    }
    return `${base.slice(0, 80)}-${randomBytes(3).toString("hex")}`;
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  }

  private cleanJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private signStreamlabsState(state: StreamlabsOAuthState) {
    return this.jwt.sign(state, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: "10m",
    });
  }

  private async verifyStreamlabsState(state?: string): Promise<StreamlabsOAuthState> {
    if (!state) return { mode: "login" };
    try {
      const decoded = await this.jwt.verifyAsync<StreamlabsOAuthState>(state, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      return decoded.mode === "connect" && decoded.userId ? { mode: "connect", userId: decoded.userId } : { mode: "login" };
    } catch {
      throw new UnauthorizedException("Invalid Streamlabs OAuth state");
    }
  }

  private async signTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: "8h",
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: "30d",
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private hashResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private async createStreamlabsExchangeCode(payload: StreamlabsLoginExchange) {
    const now = Date.now();
    for (const [code, entry] of this.pendingStreamlabsLogins.entries()) {
      if (entry.expiresAt < now) this.pendingStreamlabsLogins.delete(code);
    }
    const code = randomBytes(24).toString("hex");
    this.pendingStreamlabsLogins.set(code, {
      expiresAt: now + 5 * 60 * 1000,
      payload,
    });
    try {
      await this.redis.set(this.streamlabsExchangeKey(code), JSON.stringify(payload), "EX", 5 * 60);
    } catch (error) {
      this.logger.warn(`Redis Streamlabs exchange write failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
    return code;
  }

  private streamlabsExchangeKey(code: string) {
    return `tiphouse:auth:streamlabs:${code}`;
  }

  private publicStreamlabsError(reason: string) {
    if (reason.includes("token exchange")) return "token_exchange";
    if (reason.includes("user lookup")) return "user_lookup";
    if (reason.includes("state")) return "invalid_state";
    if (reason.includes("authorization code")) return "missing_code";
    return "unknown";
  }
}
