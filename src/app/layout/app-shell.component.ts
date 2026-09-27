import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { AnonymousSessionService } from '../core/auth/anonymous-session.service';
import { SupabaseService } from '../core/supabase/supabase.service';

@Component({
  selector: 'gv-app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatSidenavModule],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav #sidenav [mode]="isMobile ? 'over' : 'side'" [opened]="!isMobile" class="sidebar" [fixedInViewport]="isMobile">
        <a class="brand" routerLink="/dashboard" (click)="closeOnMobile(sidenav)" aria-label="Lexora home">
          <span class="brand-mark" aria-hidden="true"><span>L</span><i></i></span><span>Lexora</span>
        </a>
        <p class="sidebar-caption">A little progress, every day.</p>
        <nav class="nav-list" aria-label="Main navigation">
          <a mat-button routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeOnMobile(sidenav)"><mat-icon>space_dashboard</mat-icon><span>Dashboard</span></a>
          <a mat-button routerLink="/decks" routerLinkActive="active" (click)="closeOnMobile(sidenav)"><mat-icon>auto_awesome_mosaic</mat-icon><span>My decks</span></a>
        </nav>
        <div class="sidebar-note"><span class="mascot-face" aria-hidden="true"><i></i><i></i></span><div><strong>Small steps add up!</strong><small>Your words stay in your private workspace.</small></div></div>
        <div class="sidebar-footer"><span class="status-chip"><span class="status-dot"></span>Anonymous session</span></div>
      </mat-sidenav>

      <mat-sidenav-content>
        <header class="topbar">
          <button mat-icon-button class="menu-button" (click)="sidenav.toggle()" [attr.aria-label]="isMobile ? 'Open navigation menu' : 'Toggle navigation'" [attr.aria-expanded]="sidenav.opened"><mat-icon>{{ sidenav.opened ? 'menu_open' : 'menu' }}</mat-icon></button>
          <div class="topbar-brand"><span class="topbar-greeting">Your learning space</span><span class="topbar-context">One word at a time ✨</span></div>
          <div class="topbar-spacer"></div>
          <span class="workspace-label"><mat-icon>shield</mat-icon>Anonymous session</span>
        </header>
        <div class="setup-banner" *ngIf="!supabase.configured" role="status">
          Supabase chưa được cấu hình — app đang ở chế độ UI preview. Cập nhật <code>src/environments/environment.ts</code> để kết nối dữ liệu thật.
        </div>
        <div class="setup-banner error" *ngIf="supabase.configured && anonymous.error() as sessionError" role="alert">
          {{ sessionError }} Bật Anonymous Sign-Ins trong Supabase Dashboard rồi tải lại trang.
        </div>
        <main id="main-content"><router-outlet /></main>
        <nav class="mobile-nav" *ngIf="isMobile" aria-label="Quick navigation">
          <a mat-button routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><mat-icon>space_dashboard</mat-icon><span>Home</span></a>
          <a mat-button routerLink="/decks" routerLinkActive="active"><mat-icon>auto_awesome_mosaic</mat-icon><span>Decks</span></a>
        </nav>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .shell-container { min-height: 100vh; background: var(--surface-soft); }
    .sidebar { position: relative; width: 260px; padding: 27px 17px 88px; border-right: 1px solid var(--line); background: #fff; }
    .brand { display: flex; align-items: center; gap: 11px; padding: 0 11px; color: var(--ink); font-size: 1.42rem; font-weight: 900; letter-spacing: -.055em; }
    .brand-mark { position: relative; display: grid; place-items: center; width: 39px; height: 39px; border-radius: 15px 15px 15px 5px; background: var(--brand); color: #fff; box-shadow: 0 7px 15px rgba(13,148,136,.2); }
    .brand-mark span { font-size: 1.15rem; }
    .brand-mark i { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 50%; background: var(--accent); }
    .sidebar-caption { margin: 8px 11px 0; color: var(--muted); font-size: .82rem; }
    .nav-list { display: grid; gap: 8px; margin-top: 35px; }
    .nav-list a { min-height: 46px; justify-content: flex-start; padding: 0 13px; border-radius: 14px; color: var(--muted); font-weight: 700; transition: background .18s ease, color .18s ease, transform .18s ease; }
    .nav-list a:hover { transform: translateX(2px); background: #f3faf8; color: var(--brand-deep); }
    .nav-list a.active { background: var(--surface-mint); color: var(--brand-deep); font-weight: 850; }
    .nav-list mat-icon { margin-right: 12px; }
    .sidebar-note { display: flex; align-items: center; gap: 11px; margin: 35px 5px 0; padding: 13px 11px; border-radius: 18px; background: linear-gradient(135deg, #e9faf5, #fff8e4); }
    .sidebar-note div { display: grid; gap: 4px; min-width: 0; }
    .sidebar-note strong { font-size: .78rem; }
    .sidebar-note small { color: var(--muted); font-size: .68rem; line-height: 1.4; }
    .mascot-face { position: relative; display: flex; align-items: center; justify-content: center; flex: 0 0 39px; width: 39px; height: 34px; gap: 5px; border-radius: 48% 48% 45% 45%; background: #57cbb9; box-shadow: inset 0 -4px rgba(7,118,110,.13); }
    .mascot-face::after { position: absolute; right: -4px; top: -4px; content: '✦'; color: #e8a900; font-size: 13px; }
    .mascot-face i { width: 4px; height: 6px; border-radius: 50%; background: #12353e; }
    .sidebar-footer { position: absolute; right: 17px; bottom: 23px; left: 17px; }
    .status-chip { width: 100%; justify-content: flex-start; gap: 8px; background: #f3f8f6; color: #526b6c; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #26a269; box-shadow: 0 0 0 3px #dff5e8; }
    .topbar { position: sticky; z-index: 10; top: 0; display: flex; align-items: center; min-height: 76px; padding: 0 34px; border-bottom: 1px solid rgba(223,232,229,.8); background: rgba(255,255,255,.9); backdrop-filter: blur(16px); }
    .menu-button { display: none; }
    .topbar-brand { display: grid; gap: 2px; }
    .topbar-greeting { font-size: .95rem; font-weight: 850; letter-spacing: -.02em; }
    .topbar-context { color: var(--muted); font-size: .76rem; }
    .topbar-spacer { flex: 1; }
    .workspace-label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: .82rem; }
    .workspace-label mat-icon { width: 18px; height: 18px; color: var(--brand); font-size: 18px; }
    .setup-banner { padding: 11px 34px; background: #fff8df; color: #704f00; font-size: .84rem; line-height: 1.5; }
    .setup-banner.error { background: #fff0ee; color: #8b251c; }
    .mobile-nav { display: none; }
    @media (max-width: 800px) {
      .sidebar { width: min(300px, 84vw); padding-top: 23px; box-shadow: 10px 0 36px rgba(23,43,54,.12); }
      .menu-button { display: inline-flex; margin-right: 9px; }
      .topbar { min-height: 66px; padding: 0 16px; }
      .workspace-label { display: none; }
      .setup-banner { padding: 10px 16px; }
      .mobile-nav { position: fixed; z-index: 20; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); left: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 7px; border: 1px solid rgba(223,232,229,.9); border-radius: 20px; background: rgba(255,255,255,.94); box-shadow: 0 12px 35px rgba(23,43,54,.16); backdrop-filter: blur(18px); }
      .mobile-nav a { display: grid; min-height: 48px; place-items: center; align-content: center; gap: 1px; border-radius: 14px; color: var(--muted); font-size: .7rem; font-weight: 750; line-height: 1.15; }
      .mobile-nav a.active { background: var(--surface-mint); color: var(--brand-deep); }
      .mobile-nav a mat-icon { width: 21px; height: 21px; font-size: 21px; }
    }
  `],
})
export class AppShellComponent implements OnInit {
  readonly supabase = inject(SupabaseService);
  readonly anonymous = inject(AnonymousSessionService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  isMobile = false;

  ngOnInit(): void {
    this.breakpointObserver.observe('(max-width: 800px)')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ matches }) => { this.isMobile = matches; });
  }

  closeOnMobile(sidenav: MatSidenav): void {
    if (this.isMobile) void sidenav.close();
  }
}
