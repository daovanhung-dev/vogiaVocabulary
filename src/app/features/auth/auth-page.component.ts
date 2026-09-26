import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Component({
  selector: 'gv-auth-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <main class="auth-page">
      <section class="auth-intro">
        <p class="eyebrow">Lexora</p>
        <h1>Build a vocabulary that stays with you.</h1>
        <p class="lead">Search words in the languages you care about, save them into focused decks, and practise with a little more intention every day.</p>
        <div class="intro-points">
          <span>◎ Provider-backed word data</span>
          <span>◎ Private progress with Supabase RLS</span>
          <span>◎ Practice without an AI dependency</span>
        </div>
      </section>

      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>{{ isRegister ? 'Create your account' : 'Welcome back' }}</mat-card-title>
          <mat-card-subtitle>{{ isRegister ? 'Start your first vocabulary deck.' : 'Continue your learning loop.' }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="config-warning" *ngIf="!supabase.configured">
            <strong>Supabase chưa được cấu hình.</strong>
            <span>Điền URL và publishable key trong <code>src/environments/environment.ts</code> để bật đăng nhập.</span>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid auth-form">
            <mat-form-field appearance="outline" *ngIf="isRegister">
              <mat-label>Your name</mat-label>
              <input matInput formControlName="displayName" autocomplete="name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email" autocomplete="email" />
              <mat-error *ngIf="form.controls.email.hasError('email')">Enter a valid email.</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput formControlName="password" type="password" autocomplete="current-password" />
              <mat-error *ngIf="form.controls.password.hasError('minlength')">Use at least 6 characters.</mat-error>
            </mat-form-field>
            <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting || !supabase.configured">
              <mat-spinner diameter="20" *ngIf="submitting"></mat-spinner>
              <span *ngIf="!submitting">{{ isRegister ? 'Create account' : 'Sign in' }}</span>
            </button>
          </form>
        </mat-card-content>
        <mat-card-actions>
          <a mat-button [routerLink]="isRegister ? '/login' : '/register'">
            {{ isRegister ? 'Already have an account? Sign in' : 'New here? Create an account' }}
          </a>
        </mat-card-actions>
      </mat-card>
    </main>
  `,
  styles: [
    `
      .auth-page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(380px, .95fr); gap: 64px; align-items: center; width: min(1120px, calc(100% - 40px)); margin: auto; padding: 48px 0; }
      .auth-intro h1 { max-width: 640px; margin: 0 0 20px; font-size: clamp(2.8rem, 6vw, 5.2rem); line-height: .98; letter-spacing: -.055em; }
      .lead { max-width: 560px; color: var(--muted); font-size: 1.15rem; line-height: 1.7; }
      .intro-points { display: grid; gap: 12px; margin-top: 32px; color: var(--brand-strong); font-weight: 700; }
      .auth-card { padding: 12px; border-radius: 24px; }
      .auth-card mat-card-header { margin-bottom: 20px; }
      .auth-form { margin-top: 12px; }
      .config-warning { display: grid; gap: 8px; padding: 14px; margin-bottom: 18px; border-radius: 12px; background: #fff8e5; color: #704f00; font-size: .9rem; }
      mat-spinner { display: inline-block; margin: 0 auto; }
      @media (max-width: 800px) { .auth-page { grid-template-columns: 1fr; gap: 24px; padding: 32px 0; } .auth-intro h1 { font-size: 3.2rem; } }
    `,
  ],
})
export class AuthPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseService);
  readonly isRegister = this.route.snapshot.data['mode'] === 'register';
  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  submitting = false;
  errorMessage = '';

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting = true;
    this.errorMessage = '';
    const values = this.form.getRawValue();
    try {
      if (this.isRegister) {
        await this.auth.signUp(values.email, values.password, values.displayName);
        this.errorMessage = 'Account created. Check your email if confirmation is enabled, then sign in.';
      } else {
        await this.auth.signIn(values.email, values.password);
        await this.router.navigateByUrl('/dashboard');
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to complete authentication.';
    } finally {
      this.submitting = false;
    }
  }
}
