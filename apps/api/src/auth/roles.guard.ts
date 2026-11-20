import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_AUTHENTICATED_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import { ALL_ROLES, type AuthUser, type Role } from './roles';

/**
 * Enforces @Roles(). Runs after AuthGuard, so `request.user` is always set on protected routes.
 *
 * Fails closed: a route without @Roles() admits only the pharmacy staff roles (ALL_ROLES). An
 * account with no role, an unrecognised role or the POS-only cashier role is refused unless the
 * route names it explicitly. The only exceptions are @Public() and @AnyAuthenticatedUser().
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user)
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    if (
      this.reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED_KEY, targets)
    )
      return true;

    const declared = this.reflector.getAllAndOverride<
      readonly Role[] | undefined
    >(ROLES_KEY, targets);
    const required = declared && declared.length > 0 ? declared : ALL_ROLES;
    if (!user.role) {
      throw new ForbiddenException(
        'Your account has no role assigned. Ask an administrator to assign one before performing this action.',
      );
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
    return true;
  }
}
