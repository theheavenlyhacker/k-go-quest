import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { DataSource } from 'typeorm';
import { Role, School } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { AuditService } from '../../common/audit.service';
import { PaginationDto } from '../../common/pagination.dto';

export class CreateSchoolDto {
  @IsString() @Length(2, 120) name: string;
}

@ApiTags('Schools')
@ApiBearerAuth()
@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @Roles(Role.LGU_ADMIN)
  create(@CurrentUser() actor: Principal, @Body() dto: CreateSchoolDto) {
    return this.db.transaction(async (manager) => {
      const school = await manager.save(
        School,
        manager.create(School, {
          name: dto.name,
          jurisdictionId: actor.jurisdictionId,
        }),
      );
      await this.audit.record(actor, 'SCHOOL_CREATED', school.id, manager);
      return school;
    });
  }

  @Get()
  @Roles(Role.LGU_ADMIN, Role.TEACHER)
  async list(@CurrentUser() actor: Principal, @Query() query: PaginationDto) {
    const [items, total] = await this.db
      .getRepository(School)
      .findAndCount({
        where: {
          jurisdictionId: actor.jurisdictionId,
          ...(actor.role === Role.TEACHER ? { id: actor.schoolId! } : {}),
        },
        order: { name: 'ASC', id: 'ASC' },
        take: query.limit,
        skip: query.skip,
      });
    return { items, total, page: query.page, limit: query.limit };
  }
}

@Module({ controllers: [SchoolsController] })
export class SchoolsModule {}
