import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { isSupabaseConfigured } from '../config/app-config';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = isSupabaseConfigured();
  readonly client: SupabaseClient | null = this.configured
    ? createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  get requiredClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured. See the setup instructions in README.md.');
    }
    return this.client;
  }
}
