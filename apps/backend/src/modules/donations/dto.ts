import { PaymentProvider } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class CreateDonationDto {
  @IsString()
  pageSlug!: string;

  @IsString()
  @MaxLength(20)
  donorName!: string;

  @IsEmail()
  @MaxLength(254)
  donorEmail!: string;

  @IsString()
  @MaxLength(250)
  message!: string;

  @IsInt()
  @Min(20)
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
  @MaxLength(30)
  @Matches(/^[a-z0-9]{4,30}$/)
  @IsOptional()
  slug?: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  displayName?: string;

  @IsString()
  @MaxLength(30)
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

  @IsString()
  @IsOptional()
  quicklinkUrl?: string;

  @IsString()
  @IsOptional()
  donationBackgroundUrl?: string;

  @IsInt()
  @Min(20)
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

export class ImportDonationRowDto {
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(20000)
  amount!: number;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @MaxLength(250)
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}
