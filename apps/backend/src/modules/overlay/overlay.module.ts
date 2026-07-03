import { Module } from "@nestjs/common";
import { AlertDeliveryService } from "./alert-delivery.service";
import { OverlayController } from "./overlay.controller";
import { OverlayGateway } from "./overlay.gateway";
import { OverlayService } from "./overlay.service";

@Module({
  controllers: [OverlayController],
  providers: [OverlayGateway, OverlayService, AlertDeliveryService],
  exports: [OverlayService, AlertDeliveryService],
})
export class OverlayModule {}
