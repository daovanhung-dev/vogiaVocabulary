import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { AnonymousSessionService } from '../core/auth/anonymous-session.service';
import { SupabaseService } from '../core/supabase/supabase.service';

@Component({
  selector: 'gv-app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatSidenavModule],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav #sidenav mode="side" opened class="sidebar">
        <div class="brand"><span class="brand-mark">L</span><span>Lexora</span></div>
        <p class="sidebar-caption">Vocabulary, made personal.</p>
        <nav class="nav-list">
          <a mat-button routerLink="/dashboard" routerLinkActive="active"><mat-icon>space_dashboard</mat-icon>Overview</a>
          <a mat-button routerLink="/decks" routerLinkActive="active"><mat-icon>style</mat-icon>My decks</a>
        </nav>
        <div class="sidebar-footer">
          <span class="status-chip">Personal workspace</span>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <header class="topbar">
          <button mat-icon-button class="menu-button" (click)="sidenav.toggle()" aria-label="Toggle navigation"><mat-icon>menu</mat-icon></button>
          <div class="topbar-spacer"></div>
          <span class="workspace-label">Private workspace</span>
          <span class="avatar">{{ initials }}</span>
        </header>
        <div class="setup-banner" *ngIf="!supabase.configured">
          Supabase chưa được cấu hình — app đang ở chế độ UI preview. Cập nhật <code>src/environments/environment.ts</code> để kết nối dữ liệu thật.
        </div>
        <div class="setup-banner error" *ngIf="supabase.configured && anonymous.error() as sessionError">
          {{ sessionError }} Bật Anonymous Sign-Ins trong Supabase Dashboard rồi tải lại trang.
        </div>
        <main><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell-container { min-height: 100vh; background: var(--surface-soft); }
      .sidebar { width: 248px; padding: 24px 16px; border-right: 1px solid var(--line); background: var(--surface); }
      .brand { display: flex; align-items: center; gap: 10px; padding: 0 10px; color: var(--brand-strong); font-size: 1.35rem; font-weight: 900; letter-spacing: -.04em; }
      .brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 12px; background: var(--brand-strong); color: white; }
      .sidebar-caption { padding: 0 10px; color: var(--muted); font-size: .82rem; }
      .nav-list { display: grid; gap: 8px; margin-top: 32px; }
      .nav-list a { justify-content: flex-start; color: var(--muted); }
      .nav-list a.active { background: #eaf2f7; color: var(--brand-strong); font-weight: 800; }
      .nav-list mat-icon { margin-right: 10px; }
      .sidebar-footer { display: grid; gap: 20px; position: absolute; left: 16px; right: 16px; bottom: 24px; }
      .topbar { display: flex; align-items: center; min-height: 72px; padding: 0 32px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.86); }
      .topbar-spacer { flex: 1; }
      .workspace-label { color: var(--muted); font-size: .9rem; }
      .avatar { display: grid; place-items: center; width: 34px; height: 34px; margin-left: 14px; border-radius: 50%; background: var(--accent); color: var(--brand-strong); font-weight: 900; }
      .menu-button { display: none; }
      .setup-banner { padding: 10px 32px; background: #fff8e5; color: #704f00; font-size: .85rem; }
      .setup-banner.error { background: #fff0ee; color: #8b251c; }
      @media (max-width: 800px) { .sidebar { width: 220px; } .menu-button { display: inline-flex; } .topbar { padding: 0 16px; } .workspace-label { display: none; } }
    `,
  ],
})
export class AppShellComponent {
  readonly supabase = inject(SupabaseService);
  readonly anonymous = inject(AnonymousSessionService);

  get initials(): string {
    return 'L';
  }
}
