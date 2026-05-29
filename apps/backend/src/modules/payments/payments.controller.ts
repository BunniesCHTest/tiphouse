import { Body, Controller, Headers, Post } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

@Controller("payment")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("webhook/omise")
  omiseWebhook(@Body() payload: unknown, @Headers("x-omise-signature") signature?: string) {
    return this.payments.handleOmiseWebhook(payload, signature);
  }

  @Post("webhook/gbprimepay")
  gbPrimePayWebhook(@Body() payload: unknown, @Headers("x-gb-signature") signature?: string) {
    return this.payments.handleGbPrimePayWebhook(payload, signature);
  }
}
