import { Injectable, signal } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly session = signal<Session | null>(null);
  readonly loading = signal(true);
  private readonly ready: Promise<void>;

  constructor(private readonly supabase: SupabaseService) {
    if (!this.supabase.configured) {
      this.loading.set(false);
      this.ready = Promise.resolve();
      return;
    }

    this.ready = this.supabase.requiredClient.auth.getSession().then(({ data }) => {
      this.setSession(data.session);
      this.loading.set(false);
    });

    this.supabase.requiredClient.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      this.setSession(session);
      this.loading.set(false);
    });
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.requiredClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signUp(email: string, password: string, displayName: string): Promise<void> {
    const { error } = await this.supabase.requiredClient.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.requiredClient.auth.signOut();
    if (error) throw error;
  }

  private setSession(session: Session | null): void {
    this.session.set(session);
    this.user.set(session?.user ?? null);
  }
}
