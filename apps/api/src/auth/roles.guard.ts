import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import type { AuthUser, Role } from './roles';

/** Enforces @Roles(). Runs after AuthGuard, so `request.user` is always set on protected routes. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<readonly Role[] | undefined>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('You do not have permission to perform this action.');
    if (!user.role) {
      throw new ForbiddenException(
        'Your account has no role assigned. Ask an administrator to assign one before performing this action.',
      );
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
