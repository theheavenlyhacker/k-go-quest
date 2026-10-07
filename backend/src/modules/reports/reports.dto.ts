import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class LeagueQueryDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
}

export class ImpactQueryDto {
  @IsOptional() @Matches(/^\d{4}-Q[1-4]$/) quarter?: string;
}

export class EngagementQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}

