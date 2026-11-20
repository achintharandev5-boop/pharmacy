import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Machine authentication precedes user authentication, including login and health. */
@Injectable()
export class StagingGatewayMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    if (this.config.get<string>('DEPLOYMENT_PROFILE') !== 'synthetic-staging') {
      next();
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const expected = this.config.get<string>('STAGING_GATEWAY_TOKEN') || '';
    const supplied = request.headers['x-staging-gateway-token'];
    // Validate here as well as at startup: a missing secret must never open access.
    if (
      !/^[a-f0-9]{64}$/.test(expected) ||
      typeof supplied !== 'string' ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ) {
      response.status(401).json({ message: 'Staging access required' });
      return;
    }
    // Express strips the mounted wildcard prefix from request.path in middleware.
    // originalUrl retains the route needed for the staging side-effect policy.
    const path = request.originalUrl.split('?')[0];
    if (
      /\/(?:print|reprint|sms)\/?$/i.test(path) ||
      /^\/(?:payments|invoices|sales)(?:\/|$)/i.test(path) ||
      /^\/pos\/(?:checkout|payments|invoices|sales)(?:\/|$)/i.test(path) ||
      /^\/auth\/(?:signup|register)(?:\/|$)/i.test(path)
    ) {
      response.status(403).json({
        message:
          'Real-world issuance, messaging, payments and onboarding are disabled in synthetic staging',
      });
      return;
    }
    next();
  }
}
