import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser, Role } from './roles';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/**
 * Marks a route as reachable without authentication. Every route is protected by default;
 * this is the only way to opt out, so the allowlist is everything that carries this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to users whose `app_metadata.role` is one of the given roles. */
export const Roles = (...roles: readonly Role[]) => SetMetadata(ROLES_KEY, roles);

/** The authenticated user attached by AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
