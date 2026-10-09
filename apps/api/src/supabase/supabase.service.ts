import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

@Injectable()
export class SupabaseService {
  private readonly supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
    }

    this.supabase = createClient(
      supabaseUrl || 'http://localhost:8000',
      supabaseKey || 'dummy_key',
      {
        auth: {
          persistSession: false,
        },
        global: {
          fetch: fetch,
          headers: { 'x-my-custom-header': 'my-app-name' },
        },
        realtime: {
          // Add websocket polyfill for Node versions < 22
          transport: WebSocket as any,
        }
      }
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
