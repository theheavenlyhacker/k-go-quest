import { IsOptional, Matches } from 'class-validator';
export class LeagueQueryDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
}
