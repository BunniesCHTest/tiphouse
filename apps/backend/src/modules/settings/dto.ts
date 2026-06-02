import { IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpsertPayoutDto {
  @IsString()
  accountName!: string;

  @IsString()
  bankName!: string;

  @IsString()
  accountNumber!: string;

  @IsString()
  promptpayId!: string;
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
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class CompleteCreatorOnboardingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{4,20}$/)
  slug!: string;
}
