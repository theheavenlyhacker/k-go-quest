import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard, RolesGuard } from './modules/auth/auth.guard';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';
import { ContentModule } from './modules/content/content.module';
import { LearningModule } from './modules/learning/learning.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { ReportsModule } from './modules/reports/reports.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { HealthModule } from './modules/health/health.module';
import { RequestLoggingMiddleware } from './common/http';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
    AuthModule,
    UsersModule,
    SchoolsModule,
    ClassroomsModule,
    ContentModule,
    LearningModule,
    RewardsModule,
    ReportsModule,
    QuizzesModule,
    HealthModule,
  ],
  providers: [
    RequestLoggingMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
