import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Deck, Language } from '../../shared/models/domain.models';
import { AuthService } from '../../core/auth/auth.service';
import { DeckService } from '../decks/deck.service';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Component({
  selector: 'gv-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page">
      <section class="hero panel">
        <div>
          <p class="eyebrow">Your learning loop</p>
          <h1>Make room for one more word.</h1>
          <p class="muted">{{ greeting }}, keep your next review small and consistent.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/decks"><mat-icon>add</mat-icon>Manage decks</a>
      </section>

      <section class="grid grid-3 metric-grid">
        <mat-card><mat-card-subtitle>Active decks</mat-card-subtitle><mat-card-title>{{ decks().length }}</mat-card-title><mat-card-content><span class="muted">Your focused spaces</span></mat-card-content></mat-card>
        <mat-card><mat-card-subtitle>Words saved</mat-card-subtitle><mat-card-title>—</mat-card-title><mat-card-content><span class="muted">Visible after your first import</span></mat-card-content></mat-card>
        <mat-card><mat-card-subtitle>Review streak</mat-card-subtitle><mat-card-title>0 days</mat-card-title><mat-card-content><span class="muted">Start a practice session</span></mat-card-content></mat-card>
      </section>

      <section class="page-header section-header"><div><p class="eyebrow">Keep going</p><h2>Recent decks</h2></div><a mat-button routerLink="/decks">View all</a></section>
      <section class="grid grid-3" *ngIf="decks().length; else noDecks">
        <mat-card class="deck-card" *ngFor="let deck of decks()">
          <mat-card-header><mat-icon mat-card-avatar>style</mat-icon><mat-card-title>{{ deck.name }}</mat-card-title><mat-card-subtitle>{{ languageName(deck.source_language_id) }} → {{ languageName(deck.target_language_id) }}</mat-card-subtitle></mat-card-header>
          <mat-card-content><p>{{ deck.description || 'A small, focused vocabulary set.' }}</p></mat-card-content>
          <mat-card-actions><a mat-button color="primary" [routerLink]="['/decks', deck.id]">Open deck</a></mat-card-actions>
        </mat-card>
      </section>
      <ng-template #noDecks><div class="panel empty-state"><mat-icon>auto_stories</mat-icon><h3>Your first deck is waiting.</h3><p>Create a deck, then add words from Wiktionary.</p><a mat-flat-button color="primary" routerLink="/decks">Create a deck</a></div></ng-template>
    </div>
  `,
  styles: [`
    .hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 36px; margin-bottom: 24px; background: linear-gradient(135deg, #edf6f8, #fff8e5); }
    .hero h1 { max-width: 560px; margin: 0 0 12px; font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.05em; line-height: 1; }
    .metric-grid mat-card { padding: 20px; }
    .metric-grid mat-card-title { margin: 10px 0 4px; font-size: 2.3rem; }
    .section-header { margin-top: 40px; }
    .deck-card mat-card-content { min-height: 72px; }
    @media (max-width: 650px) { .hero { align-items: flex-start; flex-direction: column; padding: 24px; } }
  `],
})
export class DashboardComponent implements OnInit {
  readonly decks = signal<Deck[]>([]);
  readonly languages = signal<Language[]>([]);
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseService);
  private readonly deckService = inject(DeckService);

  get greeting(): string {
    return this.auth.user()?.user_metadata?.['display_name'] || this.auth.user()?.email?.split('@')[0] || 'Learner';
  }

  async ngOnInit(): Promise<void> {
    this.languages.set(await this.deckService.loadLanguages());
    this.decks.set(await this.deckService.listDecks());
  }

  languageName(id: string): string {
    return this.languages().find((language) => language.id === id)?.name ?? 'Language';
  }
}
