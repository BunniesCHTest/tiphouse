import { Module } from "@nestjs/common";
import { OverlayModule } from "../overlay/overlay.module";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [OverlayModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
