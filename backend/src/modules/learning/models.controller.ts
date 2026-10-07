import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LearningService } from './learning.service';

@ApiTags('Learning and offline sync')
@ApiBearerAuth()
@Controller('models')
export class ModelsController {
  constructor(private readonly learning: LearningService) {}

  @Get('active')
  active() {
    return this.learning.activeModelParameters();
  }
}
