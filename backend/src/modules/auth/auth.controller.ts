import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type Principal, Public } from '../../common/security';
import { DataSource } from 'typeorm';
import { User } from '../../database/entities';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './auth.dto';

@ApiTags('Authentication')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DataSource,
  ) {}
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  logout(@CurrentUser() user: Principal) {
    return this.auth.logout(user);
  }

  @Post('password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  password(@CurrentUser() user: Principal, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  @Get('me') async me(@CurrentUser() user: Principal) {
    return this.auth.profile(
      await this.db.getRepository(User).findOneByOrFail({ id: user.id }),
    );
  }
}
