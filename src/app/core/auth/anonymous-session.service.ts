import { Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class AnonymousSessionService {
  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);
  private initialization: Promise<void> | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  initialize(): Promise<void> {
    this.initialization ??= this.ensureSession()
      .catch((error: unknown) => {
        this.error.set(this.toUserMessage(error));
      })
      .finally(() => this.ready.set(true));
    return this.initialization;
  }

  private async ensureSession(): Promise<void> {
    if (!this.supabase.configured) return;

    const client = this.supabase.requiredClient;
    const current = await client.auth.getSession();
    if (current.error) throw current.error;
    if (current.data.session) {
      this.session.set(current.data.session);
      return;
    }

    const anonymous = await client.auth.signInAnonymously();
    if (anonymous.error) throw anonymous.error;
    if (!anonymous.data.session) {
      throw new Error('Supabase did not return an anonymous session.');
    }
    this.session.set(anonymous.data.session);
  }

  private toUserMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/anonymous sign[- ]ins? (are|is) disabled|anonymous sign-in is disabled/i.test(message)) {
      return 'Anonymous Sign-Ins chưa được bật trong Supabase Authentication.';
    }
    return message || 'Không thể tạo phiên làm việc riêng tư.';
  }
}
