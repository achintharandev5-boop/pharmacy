import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Single-process containment. Edge/provider limits remain an independent launch gate. */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  private readonly windowMs = 60_000;
  private readonly maxAddresses = 10_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // Do not trust caller-supplied X-Forwarded-For; Express trust proxy is not enabled.
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = this.attempts.get(address);
    if (!entry || entry.until <= now) {
      if (this.attempts.size >= this.maxAddresses) {
        for (const [key, value] of this.attempts) {
          if (value.until <= now) this.attempts.delete(key);
        }
      }
      if (
        !this.attempts.has(address) &&
        this.attempts.size >= this.maxAddresses
      ) {
        return this.reject(response, 60);
      }
      entry = { count: 0, until: now + this.windowMs };
      this.attempts.set(address, entry);
    }
    if (entry.count >= 10) {
      return this.reject(
        response,
        Math.max(1, Math.ceil((entry.until - now) / 1000)),
      );
    }
    entry.count++;
    return true;
  }

  private reject(response: Response, seconds: number): never {
    response.setHeader('Retry-After', seconds);
    throw new HttpException(
      'Too many sign-in attempts. Try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
