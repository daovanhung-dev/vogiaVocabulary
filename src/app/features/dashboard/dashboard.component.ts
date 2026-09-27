import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DashboardStats, Deck, Language } from '../../shared/models/domain.models';
import { DeckService } from '../decks/deck.service';

@Component({
  selector: 'gv-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page">
      <section class="hero panel">
        <div class="hero-copy">
          <p class="eyebrow"><mat-icon>auto_awesome</mat-icon>Your learning loop</p>
          <h1>Make room for <span>one more word.</span></h1>
          <p class="muted">Every small practice session adds up. Choose a deck or make a new one to begin.</p>
          <a mat-flat-button color="primary" routerLink="/decks"><mat-icon>add</mat-icon>Explore your decks</a>
        </div>
        <div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="sparkle sparkle-one">✦</span><span class="sparkle sparkle-two">✧</span><span class="mascot mascot-float"><i></i><i></i><b></b></span><span class="art-caption">Keep it curious!</span></div>
      </section>

      <section class="grid grid-3 metric-grid">
        <mat-card><mat-card-subtitle>Active decks</mat-card-subtitle><mat-card-title>{{ loading ? '…' : decks().length }}</mat-card-title><mat-card-content><span class="muted">Your focused spaces</span></mat-card-content></mat-card>
        <mat-card><mat-card-subtitle>Words saved</mat-card-subtitle><mat-card-title>{{ loading ? '…' : stats().wordsSaved }}</mat-card-title><mat-card-content><span class="muted">Across your active decks</span></mat-card-content></mat-card>
        <mat-card><mat-card-subtitle>Review streak</mat-card-subtitle><mat-card-title>{{ loading ? '…' : stats().reviewStreakDays + ' days' }}</mat-card-title><mat-card-content><span class="muted">Consecutive days with a review</span></mat-card-content></mat-card>
      </section>
      <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>

      <section class="page-header section-header"><div><p class="eyebrow">Keep going</p><h2>Recent decks</h2></div><a mat-button routerLink="/decks">View all</a></section>
      <section class="panel empty-state" *ngIf="loading"><p>Loading recent decks…</p></section>
      <section class="grid grid-3" *ngIf="!loading && decks().length">
        <mat-card class="deck-card" *ngFor="let deck of decks()">
          <mat-card-header><mat-icon mat-card-avatar>style</mat-icon><mat-card-title>{{ deck.name }}</mat-card-title><mat-card-subtitle>{{ languageName(deck.source_language_id) }} → {{ languageName(deck.target_language_id) }}</mat-card-subtitle></mat-card-header>
          <mat-card-content><p>{{ deck.description || 'A small, focused vocabulary set.' }}</p></mat-card-content>
          <mat-card-actions><a mat-button color="primary" [routerLink]="['/decks', deck.id]">Open deck</a></mat-card-actions>
        </mat-card>
      </section>
      <div class="panel empty-state" *ngIf="!loading && !decks().length"><mat-icon>auto_stories</mat-icon><h3>Your first deck is waiting.</h3><p>Create a deck, then add words from Wiktionary.</p><a mat-flat-button color="primary" routerLink="/decks">Create a deck</a></div>
    </div>
  `,
  styles: [`
    .hero { position: relative; display: flex; min-height: 285px; align-items: center; justify-content: space-between; gap: 24px; overflow: hidden; padding: 38px 46px; margin-bottom: 24px; background: radial-gradient(ellipse at 84% 44%, rgba(255,255,255,.88), transparent 34%), linear-gradient(120deg, #e4f7f1 0%, #f1fbf8 52%, #fff4da 100%); }
    .hero-copy { position: relative; z-index: 1; max-width: 630px; }
    .hero .eyebrow { display: flex; align-items: center; gap: 6px; }
    .hero .eyebrow mat-icon { width: 17px; height: 17px; color: #e9a900; font-size: 17px; }
    .hero h1 { max-width: 600px; margin: 0 0 13px; font-size: clamp(2.2rem, 4.7vw, 3.7rem); letter-spacing: -.06em; line-height: 1.03; }
    .hero h1 span { color: var(--brand-strong); }
    .hero .muted { max-width: 490px; margin: 0 0 22px; font-size: 1rem; line-height: 1.6; }
    .hero-art { position: relative; display: grid; width: 255px; height: 200px; flex: 0 0 255px; place-items: center; }
    .orbit { position: absolute; width: 184px; height: 184px; border: 1px dashed rgba(13,148,136,.23); border-radius: 50%; }
    .orbit-two { width: 140px; height: 140px; border-style: solid; border-color: rgba(13,148,136,.1); }
    .mascot { position: relative; display: flex; width: 104px; height: 88px; align-items: center; justify-content: center; gap: 15px; border: 4px solid rgba(255,255,255,.9); border-radius: 50% 50% 46% 46%; background: linear-gradient(145deg, #69d9c7, #21a99b); box-shadow: 0 14px 30px rgba(13,148,136,.25), inset 0 -9px rgba(7,118,110,.13); }
    .mascot i { width: 9px; height: 13px; border-radius: 50%; background: #15434a; }
    .mascot b { position: absolute; right: 16px; bottom: 24px; width: 13px; height: 7px; border-bottom: 2px solid #15434a; border-radius: 50%; }
    .sparkle { position: absolute; color: #eeae00; font-size: 27px; }
    .sparkle-one { top: 23px; right: 35px; }
    .sparkle-two { bottom: 43px; left: 16px; color: var(--coral); }
    .art-caption { position: absolute; right: -2px; bottom: 3px; padding: 7px 11px; transform: rotate(-4deg); border: 1px solid #f0dfa6; border-radius: 10px; background: #fff8df; color: #745b07; font-size: .72rem; font-weight: 800; }
    .metric-grid mat-card { padding: 21px; }
    .metric-grid mat-card-subtitle { color: var(--muted); font-weight: 700; }
    .metric-grid mat-card-title { margin: 10px 0 4px; color: var(--brand-deep); font-size: 2.25rem; font-weight: 900; }
    .section-header { margin-top: 40px; }
    .deck-card mat-card-content { min-height: 72px; }
    .deck-card mat-card-header mat-icon[mat-card-avatar] { display: grid; place-items: center; border-radius: 14px; background: var(--surface-mint); color: var(--brand); }
    @media (max-width: 700px) { .hero { min-height: auto; padding: 26px; } .hero-art { position: absolute; right: -39px; bottom: -49px; transform: scale(.76); opacity: .36; } .hero-copy { max-width: 100%; } }
  `],
})
export class DashboardComponent implements OnInit {
  readonly decks = signal<Deck[]>([]);
  readonly languages = signal<Language[]>([]);
  readonly stats = signal<DashboardStats>({ wordsSaved: 0, reviewStreakDays: 0 });
  private readonly deckService = inject(DeckService);
  loading = true;
  errorMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      const [languages, decks] = await Promise.all([
        this.deckService.loadLanguages(),
        this.deckService.listDecks(),
      ]);
      this.languages.set(languages);
      this.decks.set(decks);
      this.stats.set(await this.deckService.getDashboardStats(decks.map((deck) => deck.id)));
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load dashboard data.';
    } finally {
      this.loading = false;
    }
  }

  languageName(id: string): string {
    return this.languages().find((language) => language.id === id)?.name ?? 'Language';
  }
}
