import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ConfirmPasswordResetDto, LoginDto, RegisterDto, RequestPasswordResetDto } from "./dto";

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

  @Get("streamlabs")
  streamlabsLogin() {
    return this.auth.streamlabsLoginUrl();
  }

  @Get("streamlabs/callback")
  streamlabsCallback(@Query("code") code: string) {
    return this.auth.streamlabsCallback(code);
  }
}
