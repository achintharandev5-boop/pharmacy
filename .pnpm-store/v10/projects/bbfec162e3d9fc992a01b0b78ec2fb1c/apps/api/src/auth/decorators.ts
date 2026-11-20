import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { AuthUser, Role } from './roles';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const ANY_AUTHENTICATED_KEY = 'auth:anyAuthenticated';

/**
 * Marks a route as reachable without authentication. Every route is protected by default;
 * this is the only way to opt out, so the allowlist is everything that carries this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Lets any signed-in user through, with or without a role. For the caller's own identity only
 * (`GET /auth/me`): never use it on a route that returns or changes pharmacy records.
 */
export const AnyAuthenticatedUser = () =>
  SetMetadata(ANY_AUTHENTICATED_KEY, true);

/**
 * Restricts a route to users whose `app_metadata.role` is one of the given roles. A route without
 * @Roles() is limited to the pharmacy staff roles (ALL_ROLES); see RolesGuard.
 */
export const Roles = (...roles: readonly Role[]) =>
  SetMetadata(ROLES_KEY, roles);

/** The authenticated user attached by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
  },
);
