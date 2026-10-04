import {
  IsString,
  Length,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsString() @Length(3, 80) @Matches(/^[a-zA-Z0-9._-]+$/) loginId: string;
  @IsString() @MinLength(12) @MaxLength(128) password: string;
  @IsString() @Length(8, 80) @Matches(/^[a-zA-Z0-9_-]+$/) deviceId: string;
}
export class RefreshDto {
  @IsString()
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{64}$/,
  )
  refreshToken: string;
  @IsString() @Length(8, 80) @Matches(/^[a-zA-Z0-9_-]+$/) deviceId: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(12) @MaxLength(128) currentPassword: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword: string;
}
