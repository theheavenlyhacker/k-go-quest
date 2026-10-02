import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { AuthSession, Role, User } from '../../database/entities';
import { ScopeService } from '../../common/scope.service';
import { AuditService } from '../../common/audit.service';
import type { Principal } from '../../common/security';
import type { PaginationDto } from '../../common/pagination.dto';
import { hashPassword } from '../auth/password';
import type {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}
  async create(actor: Principal, dto: CreateUserDto) {
    if (dto.role === Role.LGU_ADMIN && dto.schoolId)
      throw new BadRequestException(
        'LGU admins belong to a jurisdiction, not a school',
      );
    if (dto.schoolId) await this.scope.school(actor, dto.schoolId);
    const passwordHash = await hashPassword(dto.password);
    return this.db.transaction(async (manager) => {
      const user = await manager.save(
        User,
        manager.create(User, {
          loginId: dto.loginId.toLowerCase(),
          alias: dto.alias,
          role: dto.role,
          schoolId: dto.schoolId ?? null,
          jurisdictionId: actor.jurisdictionId,
          passwordHash,
          lockedUntil: null,
        }),
      );
      await this.audit.record(actor, 'USER_CREATED', user.id, manager, {
        role: user.role,
      });
      return {
        id: user.id,
        loginId: user.loginId,
        alias: user.alias,
        role: user.role,
        schoolId: user.schoolId,
        active: user.active,
      };
    });
  }
  async list(actor: Principal, query: PaginationDto) {
    const [items, total] = await this.db.getRepository(User).findAndCount({
      where: { jurisdictionId: actor.jurisdictionId },
      select: {
        id: true,
        alias: true,
        role: true,
        schoolId: true,
        active: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  }
  async update(actor: Principal, id: string, dto: UpdateUserDto) {
    if (id === actor.id && dto.active === false)
      throw new BadRequestException('You cannot deactivate your own account');
    return this.db.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id, jurisdictionId: actor.jurisdictionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');
      if (dto.alias !== undefined) user.alias = dto.alias;
      if (dto.active !== undefined) user.active = dto.active;
      await manager.save(user);
      if (dto.active === false)
        await manager.update(
          AuthSession,
          { userId: id, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      await this.audit.record(actor, 'USER_UPDATED', id, manager);
      return { id, alias: user.alias, active: user.active };
    });
  }
  async resetPassword(actor: Principal, id: string, dto: ResetPasswordDto) {
    const passwordHash = await hashPassword(dto.newPassword);
    await this.db.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id, jurisdictionId: actor.jurisdictionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');
      await manager.update(User, id, {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
      });
      await manager.update(
        AuthSession,
        { userId: id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await this.audit.record(actor, 'PASSWORD_RESET_BY_ADMIN', id, manager);
    });
    return { id, changed: true, loginRequired: true };
  }
}
