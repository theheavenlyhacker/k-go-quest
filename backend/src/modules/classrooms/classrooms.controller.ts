import {
  Body,
  Controller,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { PaginationDto } from '../../common/pagination.dto';
import { CreateClassroomDto, EnrollDto } from './classrooms.dto';
import { ClassroomsService } from './classrooms.service';

@ApiTags('Classrooms')
@ApiBearerAuth()
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classes: ClassroomsService) {}
  @Post() @Roles(Role.LGU_ADMIN) create(
    @CurrentUser() actor: Principal,
    @Body() dto: CreateClassroomDto,
  ) {
    return this.classes.create(actor, dto);
  }
  @Get() list(@CurrentUser() actor: Principal, @Query() query: PaginationDto) {
    return this.classes.list(actor, query);
  }
  @Post(':id/enrollments') @Roles(Role.TEACHER, Role.LGU_ADMIN) enroll(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollDto,
  ) {
    return this.classes.enroll(actor, id, dto.studentId);
  }
  @Get(':id/learners') @Roles(Role.TEACHER, Role.LGU_ADMIN) learners(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.classes.learners(actor, id, query);
  }
  @Delete(':id/enrollments/:studentId')
  @Roles(Role.TEACHER, Role.LGU_ADMIN)
  unenroll(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.classes.unenroll(actor, id, studentId);
  }
}
