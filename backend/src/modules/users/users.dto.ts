import {
  IsBoolean,
  IsEnum,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../database/entities';

export class CreateUserDto {
  @IsString() @Length(3, 80) @Matches(/^[a-zA-Z0-9._-]+$/) loginId: string;
  @IsString() @Length(2, 80) alias: string;
  @IsEnum(Role) role: Role;
  @ValidateIf(
    (o: CreateUserDto) => o.role !== Role.LGU_ADMIN || o.schoolId !== undefined,
  )
  @IsUUID()
  schoolId?: string;
  @IsString() @MinLength(12) @MaxLength(128) password: string;
}
export class UpdateUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(2, 80)
  alias?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
export class ResetPasswordDto {
  @IsString() @MinLength(12) @MaxLength(128) newPassword: string;
}
