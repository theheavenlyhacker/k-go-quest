import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
export class RewardQueryDto extends PaginationDto {
  @IsOptional() @IsIn(['active', 'all']) status?: 'active' | 'all';
}
export class CreateRewardDto {
  @IsString() @Length(2, 120) title: string;
  @IsInt() @Min(1) @Max(100000) cost: number;
  @IsInt() @Min(0) @Max(100000) stock: number;
}
export class RedeemDto {
  @IsUUID() requestId: string;
  @IsUUID() rewardId: string;
}
export class UpdateRewardDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(2, 120)
  title?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(100000)
  cost?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  stock?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
