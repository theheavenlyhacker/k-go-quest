import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { DevicesService } from './devices.service';
import { CheckInDto, DeviceQueryDto } from './devices.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('check-in')
  checkIn(@CurrentUser() actor: Principal, @Body() dto: CheckInDto) {
    return this.devices.checkIn(actor, dto);
  }

  @Get()
  @Roles(Role.LGU_ADMIN)
  list(@CurrentUser() actor: Principal, @Query() query: DeviceQueryDto) {
    return this.devices.list(actor, query);
  }
}
