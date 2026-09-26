import { describe, expect, it } from 'vitest';
import { resolveSupabaseKeys } from '../supabase/functions/_shared/supabase-keys';

describe('resolveSupabaseKeys', () => {
  it('prefers the new Supabase JSON key maps', () => {
    expect(resolveSupabaseKeys({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_new' }),
      SUPABASE_PUBLISHABLE_KEY: 'legacy-public',
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_new' }),
      SUPABASE_SECRET_KEY: 'legacy-secret',
    })).toEqual({ publishableKey: 'sb_publishable_new', secretKey: 'sb_secret_new' });
  });

  it('falls back through custom and legacy names', () => {
    expect(resolveSupabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: 'custom-public',
      SUPABASE_SECRET_KEY: 'custom-secret',
    })).toEqual({ publishableKey: 'custom-public', secretKey: 'custom-secret' });
    expect(resolveSupabaseKeys({
      SUPABASE_ANON_KEY: 'anon-public',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-secret',
    })).toEqual({ publishableKey: 'anon-public', secretKey: 'legacy-secret' });
  });

  it('returns missing values when no usable key exists', () => {
    expect(resolveSupabaseKeys({
      SUPABASE_PUBLISHABLE_KEYS: '{invalid',
      SUPABASE_SECRET_KEYS: '  ',
    })).toEqual({ publishableKey: undefined, secretKey: undefined });
  });
});
