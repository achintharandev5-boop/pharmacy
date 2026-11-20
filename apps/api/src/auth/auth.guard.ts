import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { UserResponse } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { IS_PUBLIC_KEY } from './decorators';
import { parseRole, type AuthUser } from './roles';

/**
 * Global authentication guard. Fails closed: every route requires a valid Supabase access
 * token unless it is explicitly marked @Public(). There is no environment-based bypass.
 *
 * Tokens are verified by Supabase Auth (`auth.getUser`), which checks the signature, expiry
 * against the configured Auth service. Copied access-token behavior after logout must
 * be verified separately; this is not a promise of immediate session revocation.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    let result: UserResponse;
    try {
      result = await this.supabaseService.getClient().auth.getUser(token);
    } catch {
      this.logger.error(
        'Token verification failed: authentication service unreachable',
      );
      throw new ServiceUnavailableException(
        'Authentication service is unavailable. Please try again.',
      );
    }

    const { data, error } = result;
    if (error) {
      // Network/5xx failures from Supabase Auth are not the caller's fault; report them as such.
      const status = error.status;
      if (status === undefined || status >= 500) {
        this.logger.error(
          `Token verification failed: authentication service error (${status ?? 'network'})`,
        );
        throw new ServiceUnavailableException(
          'Authentication service is unavailable. Please try again.',
        );
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!data?.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const pharmacyId = this.config?.get<string>('PILOT_PHARMACY_ID');
    if (
      this.config?.get<string>('DEPLOYMENT_PROFILE') === 'synthetic-staging' &&
      data.user.app_metadata?.environment !== 'synthetic-staging'
    ) {
      throw new ForbiddenException(
        'A dedicated staging test account is required.',
      );
    }
    if (pharmacyId && data.user.app_metadata?.pharmacy_id !== pharmacyId) {
      throw new ForbiddenException(
        'Your account is not assigned to this pharmacy deployment.',
      );
    }

    request.user = {
      ...(typeof data.user.app_metadata?.pharmacy_id === 'string'
        ? { pharmacyId: data.user.app_metadata.pharmacy_id }
        : {}),
      id: data.user.id,
      email: data.user.email ?? null,
      role: parseRole(data.user.app_metadata?.role),
    };
    return true;
  }
}

export function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const [type, token, extra] = header.trim().split(/\s+/);
  return type?.toLowerCase() === 'bearer' && token && extra === undefined
    ? token
    : undefined;
}
