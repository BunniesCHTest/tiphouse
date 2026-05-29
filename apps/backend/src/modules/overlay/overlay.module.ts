import { Module } from "@nestjs/common";
import { OverlayGateway } from "./overlay.gateway";
import { OverlayService } from "./overlay.service";

@Module({
  providers: [OverlayGateway, OverlayService],
  exports: [OverlayService],
})
export class OverlayModule {}
