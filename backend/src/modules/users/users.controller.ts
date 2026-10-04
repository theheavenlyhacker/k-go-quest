import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { PaginationDto } from '../../common/pagination.dto';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Roles(Role.LGU_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@CurrentUser() actor: Principal, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }
  @Get()
  list(@CurrentUser() actor: Principal, @Query() query: PaginationDto) {
    return this.users.list(actor, query);
  }
  @Patch(':id')
  update(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actor, id, dto);
  }
  @Post(':id/password')
  resetPassword(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(actor, id, dto);
  }
}
