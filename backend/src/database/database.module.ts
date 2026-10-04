import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseCertificate, databaseOptions } from './data-source';
import { ScopeService } from '../common/scope.service';
import { AuditService } from '../common/audit.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        databaseOptions(
          config.getOrThrow<string>('DATABASE_URL'),
          config.getOrThrow<boolean>('DATABASE_SSL'),
          databaseCertificate({
            DATABASE_CA: config.get<string>('DATABASE_CA'),
            DATABASE_CA_PATH: config.get<string>('DATABASE_CA_PATH'),
          }),
          config.getOrThrow<string>('DATABASE_SCHEMA'),
        ),
    }),
  ],
  providers: [ScopeService, AuditService],
  exports: [TypeOrmModule, ScopeService, AuditService],
})
export class DatabaseModule {}
