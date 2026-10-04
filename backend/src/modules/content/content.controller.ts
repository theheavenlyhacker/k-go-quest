import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { ContentService } from './content.service';
import {
  ContentQueryDto,
  CreateExerciseDto,
  CreateLessonDto,
  CreatePackDto,
} from './content.dto';

@ApiTags('Content')
@ApiBearerAuth()
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}
  @Get('packs') packs(
    @CurrentUser() actor: Principal,
    @Query() query: ContentQueryDto,
  ) {
    return this.content.list(actor, query);
  }
  @Get('packs/:id/download') download(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.content.download(actor, id);
  }
  @Get('packs/:id') @Roles(Role.LGU_ADMIN) detail(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.content.detail(actor, id);
  }
  @Post('packs') @Roles(Role.LGU_ADMIN) create(
    @CurrentUser() actor: Principal,
    @Body() dto: CreatePackDto,
  ) {
    return this.content.create(actor, dto);
  }
  @Post('packs/:id/lessons') @Roles(Role.LGU_ADMIN) lesson(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.content.addLesson(actor, id, dto);
  }
  @Post('lessons/:id/exercises') @Roles(Role.LGU_ADMIN) exercise(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.content.addExercise(actor, id, dto);
  }
  @Post('packs/:id/publish') @Roles(Role.LGU_ADMIN) publish(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.content.publish(actor, id);
  }
}
