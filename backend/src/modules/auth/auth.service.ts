import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';
import { AuthSession, User } from '../../database/entities';
import { AuditService } from '../../common/audit.service';
import type { Principal } from '../../common/security';
import type { ChangePasswordDto, LoginDto, RefreshDto } from './auth.dto';
import { hashPassword, tokenHash, verifyPassword } from './password';

@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(
    private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}
  async login(dto: LoginDto) {
    const repo = this.db.getRepository(User);
    const user = await repo
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.failedLogins', 'u.lockedUntil'])
      .where('u.loginId = :loginId', { loginId: dto.loginId.toLowerCase() })
      .getOne();
    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (
      !user ||
      !valid ||
      !user.active ||
      (user.lockedUntil && user.lockedUntil > new Date())
    ) {
      if (user && !(user.lockedUntil && user.lockedUntil > new Date())) {
        await repo
          .createQueryBuilder()
          .update(User)
          .set({
            failedLogins: () => '"failedLogins" + 1',
            lockedUntil: () =>
              `CASE WHEN "failedLogins" + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END`,
          })
          .where('id = :id', { id: user.id })
          .execute();
      }
      throw new UnauthorizedException(
        'Invalid credentials or temporarily unavailable account',
      );
    }
    return this.db.transaction(async (manager) => {
      const current = await manager.findOneOrFail(User, {
        where: { id: user.id },
        select: {
          id: true,
          active: true,
          passwordHash: true,
          lockedUntil: true,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !current.active ||
        (current.lockedUntil && current.lockedUntil > new Date()) ||
        !(await verifyPassword(dto.password, current.passwordHash))
      )
        throw new UnauthorizedException(
          'Invalid credentials or temporarily unavailable account',
        );
      await manager.update(User, user.id, {
        failedLogins: 0,
        lockedUntil: null,
      });
      await manager.update(
        AuthSession,
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      const session = manager.create(AuthSession, {
        userId: user.id,
        deviceId: dto.deviceId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        revokedAt: null,
      });
      const refreshToken = `${session.id}.${randomBytes(48).toString('base64url')}`;
      session.refreshHash = tokenHash(refreshToken);
      await manager.save(session);
      await this.audit.record(user, 'AUTH_LOGIN', session.id, manager);
      return {
        ...(await this.tokens(user, session.id, refreshToken)),
        user: this.profile(user),
      };
    });
  }
  private async tokens(user: User, sessionId: string, refreshToken: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithm: 'HS256',
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: 'kgo-api',
        expiresIn: 900,
      },
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900 };
  }
  profile(user: User) {
    return {
      id: user.id,
      loginId: user.loginId,
      alias: user.alias,
      role: user.role,
      jurisdictionId: user.jurisdictionId,
      schoolId: user.schoolId,
      coins: user.coins,
    };
  }
  async refresh(dto: RefreshDto) {
    const id = dto.refreshToken.split('.')[0];
    return this.db.transaction(async (manager) => {
      // Lock user before session everywhere, preventing login/refresh deadlocks.
      const found = await manager.findOneBy(AuthSession, { id });
      if (!found) throw new UnauthorizedException('Invalid refresh token');
      const user = await manager.findOne(User, {
        where: { id: found.userId },
        lock: { mode: 'pessimistic_write' },
      });
      const session = await manager.findOne(AuthSession, {
        where: { id },
        select: {
          id: true,
          userId: true,
          deviceId: true,
          refreshHash: true,
          revokedAt: true,
          expiresAt: true,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !user?.active ||
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.deviceId !== dto.deviceId ||
        session.refreshHash !== tokenHash(dto.refreshToken)
      )
        throw new UnauthorizedException('Invalid refresh token');
      const refreshToken = `${id}.${randomBytes(48).toString('base64url')}`;
      await manager.update(AuthSession, id, {
        refreshHash: tokenHash(refreshToken),
      });
      return this.tokens(user, id, refreshToken);
    });
  }
  async logout(user: Principal) {
    await this.db.transaction(async (manager) => {
      await manager.update(
        AuthSession,
        { id: user.sessionId, userId: user.id },
        { revokedAt: new Date() },
      );
      await this.audit.record(user, 'AUTH_LOGOUT', user.sessionId, manager);
    });
    return { loggedOut: true };
  }
  async changePassword(user: Principal, dto: ChangePasswordDto) {
    const hash = await hashPassword(dto.newPassword);
    await this.db.transaction(async (manager) => {
      const current = await manager.findOneOrFail(User, {
        where: { id: user.id },
        select: { id: true, passwordHash: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!(await verifyPassword(dto.currentPassword, current.passwordHash)))
        throw new UnauthorizedException('Invalid credentials');
      await manager.update(User, user.id, {
        passwordHash: hash,
        failedLogins: 0,
        lockedUntil: null,
      });
      await manager.update(
        AuthSession,
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await this.audit.record(user, 'PASSWORD_CHANGED', user.id, manager);
    });
    return { changed: true, loginRequired: true };
  }
}
