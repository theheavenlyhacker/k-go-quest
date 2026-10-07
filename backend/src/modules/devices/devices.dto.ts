import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class PackVersionItemDto {
  @IsOptional()
  @IsString()
  packId?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  version: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsInt()
  grade?: number;

  @IsOptional()
  @IsString()
  title?: string;
}

export class CheckInDto {
  @IsString()
  @Length(1, 80)
  deviceId: string;

  @IsString()
  @Length(1, 40)
  appVersion: string;

  @IsArray()
  packVersions: Array<PackVersionItemDto | Record<string, unknown>>;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  storageUsedPercent: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingAttempts: number;
}

export class DeviceQueryDto extends PaginationDto {}
