import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  @Get('health/db')
  async getDbHealth() {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { status: 'error', error: error.message };
    }

    return { status: 'ok', count };
  }
}
