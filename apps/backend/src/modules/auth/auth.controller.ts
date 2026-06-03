import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { ChangePasswordDto, ConfirmPasswordResetDto, LoginDto, RegisterDto, RequestPasswordResetDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("password-reset/request")
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Post("password-reset/confirm")
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto);
  }

  @Get("streamlabs")
  streamlabsLogin() {
    return this.auth.streamlabsLoginUrl();
  }

  @UseGuards(JwtAuthGuard)
  @Get("streamlabs/connect")
  streamlabsConnect(@CurrentUser() user: JwtUser) {
    return this.auth.streamlabsLoginUrl(user.sub);
  }

  @Get("streamlabs/callback")
  streamlabsCallback(@Query("code") code: string, @Query("state") state: string | undefined, @Res() res: Response) {
    return this.auth.streamlabsCallback(code, state, res);
  }

  @Post("streamlabs/exchange")
  streamlabsExchange(@Body("code") code: string) {
    return this.auth.exchangeStreamlabsLogin(code);
  }
}
