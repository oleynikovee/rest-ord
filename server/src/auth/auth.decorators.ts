import {
  type CustomDecorator,
  type ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import type { Role, User } from '../domain/models.js';
import type { AuthenticatedRequest } from './auth.types.js';

export const IS_PUBLIC = 'auth:isPublic';
export const REQUIRED_ROLES = 'auth:roles';

/** Opens a route to anonymous users. Every other route requires a valid session. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to the given roles (on top of requiring a session). */
export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(REQUIRED_ROLES, roles);

/** The authenticated user, as verified by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): User | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
