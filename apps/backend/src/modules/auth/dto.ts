import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: "Password must be at least 8 characters and include uppercase, number, and special character",
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  slug!: string;
}

export class LoginDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
