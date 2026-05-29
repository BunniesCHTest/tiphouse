import { Module } from "@nestjs/common";
import { OverlayController } from "./overlay.controller";
import { OverlayGateway } from "./overlay.gateway";
import { OverlayService } from "./overlay.service";

@Module({
  controllers: [OverlayController],
  providers: [OverlayGateway, OverlayService],
  exports: [OverlayService],
})
export class OverlayModule {}
