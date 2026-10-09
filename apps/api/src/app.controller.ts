import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';
import { Public } from './auth/decorators';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /** Liveness only: the process is up. Public so load balancers can reach it. */
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  /** Readiness: the database answers a real query. Requires authentication. */
  @Get('health/db')
  async getDbHealth() {
    const { error } = await this.supabaseService
      .getClient()
      .from('products')
      .select('id', { count: 'exact', head: true });

    if (error) {
      this.logger.error(`Database health check failed (${error.code ?? 'unknown'})`);
      throw new ServiceUnavailableException({ status: 'error', message: 'Database is not reachable' });
    }
    return { status: 'ok', checkedAt: new Date().toISOString() };
  }
}
