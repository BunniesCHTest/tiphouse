import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { UpdateProfileDto, UpsertPayoutDto, UpdateOverlayDto } from "./dto";
import { SettingsService } from "./settings.service";

@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("profile")
  profile(@CurrentUser() user: JwtUser) {
    return this.settings.getProfile(user.sub);
  }

  @Patch("profile")
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.settings.updateProfile(user.sub, dto);
  }

  @Get("payout")
  payout(@CurrentUser() user: JwtUser) {
    return this.settings.getPayout(user.sub);
  }

  @Patch("payout")
  updatePayout(@CurrentUser() user: JwtUser, @Body() dto: UpsertPayoutDto) {
    return this.settings.upsertPayout(user.sub, dto);
  }

  @Get("overlay")
  overlay(@CurrentUser() user: JwtUser) {
    return this.settings.getOverlay(user.sub);
  }

  @Patch("overlay")
  updateOverlay(@CurrentUser() user: JwtUser, @Body() dto: UpdateOverlayDto) {
    return this.settings.updateOverlay(user.sub, dto);
  }

  @Post("overlay/test")
  testOverlay(@CurrentUser() user: JwtUser, @Body() dto: UpdateOverlayDto) {
    return this.settings.testOverlay(user.sub, dto);
  }
}
