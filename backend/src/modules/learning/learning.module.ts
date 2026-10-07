import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { ModelsController } from './models.controller';
import { LearningService } from './learning.service';

@Module({
  controllers: [LearningController, ModelsController],
  providers: [LearningService],
})
export class LearningModule {}

