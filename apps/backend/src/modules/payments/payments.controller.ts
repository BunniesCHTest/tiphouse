import { Body, Controller, Headers, Post, RawBodyRequest, Req } from "@nestjs/common";
import { Request } from "express";
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

  @Post("webhook/stripe")
  stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    return this.payments.handleStripeWebhook(request.rawBody, signature);
  }

}
