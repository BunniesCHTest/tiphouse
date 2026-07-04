import { Body, Controller, Headers, Param, Post, RawBodyRequest, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
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

  @Post("slip/:ref/verify")
  @UseInterceptors(FileInterceptor("slip", {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      const accepted = allowed.includes(file.mimetype);
      callback(accepted ? null : new Error("Slip must be JPG, PNG, or WEBP"), accepted);
    },
  }))
  verifySlip(
    @Param("ref") ref: string,
    @UploadedFile() slip?: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    return this.payments.verifySlip(ref, slip);
  }
}
