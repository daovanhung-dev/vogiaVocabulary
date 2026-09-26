import { environment } from '../../../environments/environment';

export function isSupabaseConfigured(): boolean {
  return (
    environment.supabaseUrl.startsWith('https://') &&
    !environment.supabaseUrl.includes('your-project') &&
    environment.supabasePublishableKey.length > 20 &&
    !environment.supabasePublishableKey.includes('your-anon')
  );
}

export function requireSupabaseConfiguration(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Copy your project URL and publishable key into src/environments/environment.ts.');
  }
}
