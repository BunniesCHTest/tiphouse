import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto, RegisterDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          page: {
            create: {
              slug: dto.slug,
              displayName: dto.displayName,
              handle: `@${dto.username}`,
              theme: { name: "Aurora Mint", accent: "#38e2c2" },
            },
          },
          overlay: { create: { theme: { name: "Neon Glow" }, animation: { position: "center", duration: 7 } } },
        },
        select: { id: true, email: true, username: true, role: true },
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
    const user = dto.email
      ? await this.prisma.user.findUnique({ where: { email: dto.email } })
      : dto.username
        ? await this.prisma.user.findUnique({ where: { username: dto.username } })
        : null;
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      tokens: await this.signTokens(user.id, user.email, user.role),
    };
  }

  streamlabsLoginUrl() {
    const clientId = this.config.get<string>("STREAMLABS_CLIENT_ID");
    const redirectUri = this.config.get<string>("STREAMLABS_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      return { configured: false, url: null, message: "Streamlabs OAuth is not configured" };
    }
    const url = new URL("https://streamlabs.com/api/v2.0/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "donations.read socket.token");
    return { configured: true, url: url.toString() };
  }

  streamlabsCallback(code: string) {
    return {
      ok: true,
      codeReceived: Boolean(code),
      message: "Exchange this code server-side for Streamlabs tokens before production launch.",
    };
  }

  private async signTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: "15m",
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: "30d",
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
