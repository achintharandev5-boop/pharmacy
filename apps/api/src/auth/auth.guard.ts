import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Skip auth for health endpoints and login
    if (path.startsWith('/health') || path === '/auth/login') {
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        // Dev mode fallback user
        (request as any).user = { id: '00000000-0000-0000-0000-000000000000', email: 'dev@pharmacy.local' };
        return true;
      }
      throw new UnauthorizedException('No authorization bearer token found');
    }

    try {
      const { data: { user }, error } = await this.supabaseService.getClient().auth.getUser(token);
      
      if (!error && user) {
        (request as any).user = user;
        return true;
      }
    } catch (e) {
      // Failed token verification
    }

    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      (request as any).user = { id: '00000000-0000-0000-0000-000000000000', email: 'dev@pharmacy.local' };
      return true;
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
