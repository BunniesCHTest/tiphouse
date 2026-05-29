import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

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
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  email?: string;
}
