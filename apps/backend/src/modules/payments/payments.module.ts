import { Module, forwardRef } from "@nestjs/common";
import { DonationsModule } from "../donations/donations.module";
import { OverlayModule } from "../overlay/overlay.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [DonationsModule, forwardRef(() => OverlayModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
