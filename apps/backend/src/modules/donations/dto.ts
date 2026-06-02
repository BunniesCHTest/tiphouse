import { PaymentProvider } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateDonationDto {
  @IsString()
  pageSlug!: string;

  @IsString()
  @MaxLength(80)
  donorName!: string;

  @IsString()
  @MaxLength(250)
  message!: string;

  @IsInt()
  @Min(1)
  @Max(20000)
  amount!: number;

  @IsBoolean()
  anonymous!: boolean;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider: PaymentProvider = PaymentProvider.PROMPTPAY;
}

export class UpdateDonationPageDto {
  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  handle?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsString()
  @IsOptional()
  soundUrl?: string;

  @IsString()
  @IsOptional()
  donationAccountName?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  minAmount?: number;

  @IsInt()
  @Min(100)
  @IsOptional()
  goalAmount?: number;

  @IsObject()
  @IsOptional()
  theme?: Record<string, unknown>;
}
