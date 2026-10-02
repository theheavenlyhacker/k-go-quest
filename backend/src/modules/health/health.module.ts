import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../../common/security';
import { inspectSchema } from '../../database/schema';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}
  @Public() @Get('live') live() {
    return { status: 'ok' };
  }
  @Public() @Get('ready') async ready() {
    try {
      const result = await inspectSchema(this.db);
      if (!result.ready) throw new Error('Schema is not ready');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException(
        'Database or application schema unavailable',
      );
    }
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
