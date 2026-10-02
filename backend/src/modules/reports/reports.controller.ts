import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { PaginationDto } from '../../common/pagination.dto';
import { LeagueQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports and league')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('classrooms/:id') @Roles(Role.TEACHER) classroom(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reports.classroom(actor, id);
  }
  @Get('impact') @Roles(Role.LGU_ADMIN) impact(
    @CurrentUser() actor: Principal,
  ) {
    return this.reports.impact(actor);
  }
  @Get('league') league(
    @CurrentUser() actor: Principal,
    @Query() query: LeagueQueryDto,
  ) {
    return this.reports.league(actor, query.month);
  }
  @Get('audit') @Roles(Role.LGU_ADMIN) audit(
    @CurrentUser() actor: Principal,
    @Query() query: PaginationDto,
  ) {
    return this.reports.audit(actor, query);
  }
}
