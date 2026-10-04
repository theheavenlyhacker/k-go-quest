import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { SyncDto } from './sync.dto';
import { LearningService } from './learning.service';

@ApiTags('Learning and offline sync')
@ApiBearerAuth()
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}
  @Post('sync')
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  sync(@CurrentUser() actor: Principal, @Body() dto: SyncDto) {
    return this.learning.sync(actor, dto);
  }
  @Get('progress/me') @Roles(Role.STUDENT) me(@CurrentUser() actor: Principal) {
    return this.learning.progress(actor, actor.id);
  }
  @Get('learners/:id/progress') @Roles(Role.TEACHER) learner(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learning.progress(actor, id);
  }
  @Get('quests') @Roles(Role.STUDENT) quests(@CurrentUser() actor: Principal) {
    return this.learning.quests(actor);
  }
}
