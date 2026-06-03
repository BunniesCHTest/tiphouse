import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CreateDonationDto, UpdateDonationPageDto } from "./dto";
import { DonationsService } from "./donations.service";

@Controller()
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get("page/:slug")
  getPage(@Param("slug") slug: string) {
    return this.donations.getPublicPage(slug);
  }

  @Get("donations/latest/:slug")
  latest(@Param("slug") slug: string) {
    return this.donations.latest(slug);
  }

  @Get("donations/rank/:slug")
  rank(@Param("slug") slug: string) {
    return this.donations.rank(slug);
  }

  @Get("donations/receipt/:ref")
  receipt(@Param("ref") ref: string) {
    return this.donations.receipt(ref);
  }

  @Post("donate")
  create(@Body() dto: CreateDonationDto, @Req() req: any) {
    return this.donations.createPending(dto, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("dashboard")
  dashboard(@CurrentUser() user: JwtUser) {
    return this.donations.dashboard(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("settings/page")
  updatePage(@CurrentUser() user: JwtUser, @Body() dto: UpdateDonationPageDto) {
    return this.donations.updatePage(user.sub, dto);
  }
}
