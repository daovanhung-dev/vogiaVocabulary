import { describe, expect, it, vi } from 'vitest';
import { AnonymousSessionService } from '../src/app/core/auth/anonymous-session.service';
import { SupabaseService } from '../src/app/core/supabase/supabase.service';

function createService(auth: {
  getSession: () => Promise<{ data: { session: unknown }; error: Error | null }>;
  signInAnonymously: () => Promise<{ data: { session: unknown }; error: Error | null }>;
}): AnonymousSessionService {
  const supabase = {
    configured: true,
    requiredClient: { auth },
  } as unknown as SupabaseService;
  return new AnonymousSessionService(supabase);
}

describe('AnonymousSessionService', () => {
  it('reuses an existing session without creating another one', async () => {
    const session = { access_token: 'existing' };
    const signInAnonymously = vi.fn();
    const service = createService({
      getSession: async () => ({ data: { session }, error: null }),
      signInAnonymously,
    });

    await service.initialize();

    expect(service.session()).toBe(session);
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(service.ready()).toBe(true);
    expect(service.error()).toBeNull();
  });

  it('creates an anonymous session when storage has no session', async () => {
    const session = { access_token: 'anonymous' };
    const service = createService({
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => ({ data: { session }, error: null }),
    });

    await service.initialize();

    expect(service.session()).toBe(session);
    expect(service.ready()).toBe(true);
    expect(service.error()).toBeNull();
  });

  it('exposes a clear setup error when anonymous sign-ins are disabled', async () => {
    const service = createService({
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => ({
        data: { session: null },
        error: new Error('Anonymous sign-ins are disabled'),
      }),
    });

    await service.initialize();

    expect(service.ready()).toBe(true);
    expect(service.error()).toContain('Anonymous Sign-Ins chưa được bật');
  });
});
