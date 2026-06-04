import { IsBoolean, IsEmail, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpsertPayoutDto {
  @IsString()
  accountName!: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  bankName!: string;

  @IsString()
  @IsOptional()
  branchName?: string;

  @IsString()
  @IsOptional()
  accountType?: string;

  @IsString()
  accountNumber!: string;

  @IsString()
  @IsOptional()
  payoutMethod?: string;

  @IsString()
  @IsOptional()
  promptpayType?: string;

  @IsString()
  @IsOptional()
  promptpayId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateOverlayDto {
  @IsString()
  @IsOptional()
  streamerKey?: string;

  @IsString()
  @IsOptional()
  soundUrl?: string;

  @IsBoolean()
  @IsOptional()
  ttsEnabled?: boolean;

  @IsObject()
  @IsOptional()
  theme?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  animation?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  testDonorName?: string;

  @IsString()
  @IsOptional()
  testMessage?: string;

  @IsString()
  @IsOptional()
  testAmount?: string;
}

export class UpdateProfileDto {
  @IsString()
  @Matches(/^[a-z0-9]{4,30}$/)
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEmail()
  @IsOptional()
  donationNotificationEmail?: string;
}

export class CompleteCreatorOnboardingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  displayName!: string;

  @IsString()
  @Matches(/^[a-z0-9]{4,30}$/)
  slug!: string;

  @IsEmail()
  @IsOptional()
  donationNotificationEmail?: string;
}
