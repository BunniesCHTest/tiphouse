import { IsBoolean, IsEmail, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpsertPayoutDto {
  @IsString()
  @MaxLength(3_000_000)
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/)
  receivingQrImageUrl!: string;

  @IsString()
  @MaxLength(2_000)
  receivingQrPayload!: string;

  @IsString()
  @Matches(/^[0-9]{9,10}$/)
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @Matches(/^[0-9]{1,20}$/)
  @IsOptional()
  slipOkBranchId?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @IsOptional()
  slipOkApiKey?: string;
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
