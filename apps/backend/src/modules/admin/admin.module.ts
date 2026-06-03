import { Module } from "@nestjs/common";
import { OverlayModule } from "../overlay/overlay.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [OverlayModule],
  controllers: [AdminController],
})
export class AdminModule {}
