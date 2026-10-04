import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import { isUUID } from 'class-validator';
import { AuthSession, User, Role } from '../../database/entities';
import {
  type AuthenticatedRequest,
  PUBLIC_ROUTE,
  ROLE_METADATA,
} from '../../common/security';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly db: DataSource,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(match[1], {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: 'kgo-api',
      });
      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub) ||
        typeof payload.sid !== 'string' ||
        !isUUID(payload.sid)
      )
        throw new Error('Invalid claims');
    } catch {
      throw new UnauthorizedException();
    }
    const session = await this.db.getRepository(AuthSession).findOneBy({
      id: payload.sid,
      userId: payload.sub,
      revokedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
    const user = session
      ? await this.db
          .getRepository(User)
          .findOneBy({ id: payload.sub, active: true })
      : null;
    if (!user || !session) throw new UnauthorizedException();
    req.user = {
      id: user.id,
      role: user.role,
      jurisdictionId: user.jurisdictionId,
      schoolId: user.schoolId,
      sessionId: session.id,
    };
    return true;
  }
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLE_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (
      roles &&
      !roles.includes(
        ctx.switchToHttp().getRequest<AuthenticatedRequest>().user?.role,
      )
    )
      throw new ForbiddenException();
    return true;
  }
}
