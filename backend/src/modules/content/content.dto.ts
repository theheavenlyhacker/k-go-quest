import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Subject } from '../../database/entities';
import { PaginationDto } from '../../common/pagination.dto';

export class ContentQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(Subject) subject?: Subject;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) grade?: number;
  @IsOptional() @IsIn(['published', 'draft']) status?: 'published' | 'draft';
}
export class CreatePackDto {
  @IsString() @Length(2, 120) title: string;
  @IsEnum(Subject) subject: Subject;
  @IsInt() @Min(1) @Max(12) grade: number;
  @IsString() @Length(1, 30) version: string;
  @IsString() @Length(2, 500) attribution: string;
}
export class HintDto {
  @IsString() @Length(1, 2000) en: string;
  @IsOptional() @IsString() @Length(1, 2000) tl?: string;
  @IsOptional() @IsString() @Length(1, 2000) ceb?: string;
  @IsOptional() @IsString() @Length(1, 2000) ilo?: string;
}
export class CreateLessonDto {
  @IsString() @Length(2, 120) title: string;
  @IsString() @Length(2, 100) skillCode: string;
  @IsString() @Length(2, 20000) body: string;
  @IsDefined() @ValidateNested() @Type(() => HintDto) hints: HintDto;
}
export class CreateExerciseDto {
  @IsString() @Length(2, 2000) prompt: string;
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @Length(1, 500, { each: true })
  options: string[];
  @IsInt() @Min(0) @Max(5) correctOption: number;
  @IsInt() @Min(0) @Max(20) coinAward: number = 5;
}
