import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../database/entities';

export interface Principal {
  id: string;
  role: Role;
  jurisdictionId: string;
  schoolId: string | null;
  sessionId: string;
}
export interface AuthenticatedRequest extends Request {
  user: Principal;
  requestId: string;
}
export const PUBLIC_ROUTE = 'public-route';
export const ROLE_METADATA = 'allowed-roles';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLE_METADATA, roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
