import { IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
export class CreateClassroomDto {
  @IsUUID() schoolId: string;
  @IsUUID() teacherId: string;
  @IsString() @Length(2, 80) name: string;
  @IsInt() @Min(1) @Max(12) grade: number;
}
export class EnrollDto {
  @IsUUID() studentId: string;
}
