import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttemptDto {
  @IsUUID() clientAttemptId: string;
  @IsUUID() classroomId: string;
  @IsUUID() exerciseId: string;
  @IsInt() @Min(0) @Max(5) selectedOption: number;
  @IsISO8601({ strict: true }) occurredAt: string;
}
export class SyncDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((a: AttemptDto) => a.clientAttemptId)
  @ValidateNested({ each: true })
  @Type(() => AttemptDto)
  attempts: AttemptDto[];
}
