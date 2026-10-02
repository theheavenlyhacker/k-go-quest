import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { PaginationDto } from '../../common/pagination.dto';
import {
  CreateRewardDto,
  RedeemDto,
  RewardQueryDto,
  UpdateRewardDto,
} from './rewards.dto';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}
  @Get() list(@CurrentUser() actor: Principal, @Query() query: RewardQueryDto) {
    return this.rewards.list(actor, query);
  }
  @Post() @Roles(Role.LGU_ADMIN) create(
    @CurrentUser() actor: Principal,
    @Body() dto: CreateRewardDto,
  ) {
    return this.rewards.create(actor, dto);
  }
  @Patch(':id') @Roles(Role.LGU_ADMIN) update(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.rewards.update(actor, id, dto);
  }
  @Post('redemptions') @Roles(Role.STUDENT) redeem(
    @CurrentUser() actor: Principal,
    @Body() dto: RedeemDto,
  ) {
    return this.rewards.redeem(actor, dto);
  }
  @Get('redemptions/me') @Roles(Role.STUDENT) vouchers(
    @CurrentUser() actor: Principal,
    @Query() query: PaginationDto,
  ) {
    return this.rewards.myVouchers(actor, query);
  }
  @Post('redemptions/:id/claim') @Roles(Role.LGU_ADMIN) claim(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rewards.claim(actor, id);
  }
}
