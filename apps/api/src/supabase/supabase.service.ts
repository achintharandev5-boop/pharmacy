import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

/**
 * Holds the server-side Supabase client. It uses the service-role key, which bypasses Row
 * Level Security, so it must never be exposed to the browser and must never hold a user
 * session: user sign-in uses a separate, throwaway client (see createSessionClient).
 */
@Injectable()
export class SupabaseService {
  private readonly supabase: SupabaseClient;
  private readonly url: string;
  private readonly key: string;

  constructor(private readonly configService: ConfigService) {
    // Presence and format are checked by validateEnv at startup.
    this.url = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.key = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = this.build();
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * A new client for a single sign-in. Signing in stores the user's session on the client
   * that performed it, so this must never be the shared service client: otherwise later
   * queries would run with that user's token instead of the service key.
   */
  createSessionClient(): SupabaseClient {
    return this.build();
  }

  private build(): SupabaseClient {
    return createClient(this.url, this.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch },
      realtime: {
        // WebSocket polyfill for Node versions < 22.
        transport: WebSocket as any,
      },
    });
  }
}
