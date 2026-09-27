import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Deck, DeckItem } from '../../shared/models/domain.models';
import { DeckService } from './deck.service';

@Component({
  selector: 'gv-deck-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page" *ngIf="deck() as current">
      <a mat-button routerLink="/decks"><mat-icon>arrow_back</mat-icon>All decks</a>
      <section class="deck-hero panel"><div><p class="eyebrow">{{ current.source_language?.name }} → {{ current.target_language?.name }}</p><h1>{{ current.name }}</h1><p class="muted">{{ current.description || 'A focused vocabulary set.' }}</p></div><div class="hero-actions"><a mat-flat-button color="primary" [routerLink]="['/decks', current.id, 'add']"><mat-icon>add</mat-icon>Add words</a><a mat-stroked-button [routerLink]="['/decks', current.id, 'practice']"><mat-icon>play_arrow</mat-icon>Practice</a></div></section>
      <section class="grid grid-3 stats"><mat-card><mat-card-subtitle>Words</mat-card-subtitle><mat-card-title>{{ items().length }}</mat-card-title></mat-card><mat-card><mat-card-subtitle>Mastered</mat-card-subtitle><mat-card-title>{{ masteredCount }}</mat-card-title></mat-card><mat-card><mat-card-subtitle>Due now</mat-card-subtitle><mat-card-title>{{ dueCount }}</mat-card-title></mat-card></section>
      <section class="panel panel-content"><div class="card-header"><div><p class="eyebrow">Deck preview</p><h2>Recently added</h2></div><a mat-button color="primary" [routerLink]="['/decks', current.id, 'vocabulary']">View library</a></div><div class="word-list" *ngIf="items().length; else empty"><div class="word-row" *ngFor="let item of items().slice(0, 8)"><strong>{{ item.lexeme?.term }}</strong><span>{{ firstMeaning(item) }}</span><span class="status-chip">{{ masteryLabel(item) }}</span></div></div><ng-template #empty><div class="empty-state">No vocabulary yet. Add your first words from the dictionary.</div></ng-template></section>
    </div>
    <div class="page" *ngIf="loading"><div class="panel empty-state loading-state"><mat-icon class="spin">autorenew</mat-icon><p>Loading your deck…</p></div></div>
    <div class="page" *ngIf="!loading && !deck()"><div class="panel empty-state"><mat-icon>sentiment_dissatisfied</mat-icon><h2>We couldn't open this deck.</h2><p>{{ errorMessage || 'It may have been archived or is no longer available.' }}</p><a mat-flat-button color="primary" routerLink="/decks">Back to decks</a></div></div>
  `,
  styles: [`
    .deck-hero { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 32px; margin: 16px 0 24px; background: linear-gradient(135deg, #edf6f8, #fff); }
    .deck-hero h1 { margin: 0 0 10px; font-size: clamp(2.4rem, 5vw, 4.5rem); letter-spacing: -.06em; }
    .hero-actions { display: flex; gap: 10px; }
    .stats { margin-bottom: 24px; }
    .stats mat-card { padding: 18px; }
    .stats mat-card-title { margin-top: 8px; font-size: 2rem; }
    .word-list { display: grid; }
    .spin { animation: mascot-float 1.4s ease-in-out infinite; }
    .word-row { display: grid; grid-template-columns: minmax(110px, .7fr) minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--line); animation: card-enter .35s ease both; }
    .word-row:nth-child(2) { animation-delay: .04s; }
    .word-row:nth-child(3) { animation-delay: .08s; }
    .word-row:nth-child(4) { animation-delay: .12s; }
    .word-row:last-child { border-bottom: 0; }
    @media (max-width: 700px) { .deck-hero { align-items: flex-start; flex-direction: column; padding: 24px; } .word-row { grid-template-columns: 1fr auto; } .word-row span:nth-child(2) { grid-column: 1 / -1; grid-row: 2; } }
  `],
})
export class DeckDetailComponent implements OnInit {
  readonly deck = signal<Deck | null>(null);
  readonly items = signal<DeckItem[]>([]);
  private readonly route = inject(ActivatedRoute);
  private readonly deckService = inject(DeckService);
  private readonly destroyRef = inject(DestroyRef);
  loading = true;
  errorMessage = '';
  private requestVersion = 0;

  get masteredCount(): number {
    return this.items().filter((item) => (item.review_state?.mastery ?? 0) >= 0.8).length;
  }

  get dueCount(): number {
    const now = Date.now();
    return this.items().filter((item) => !item.review_state?.next_review_at || new Date(item.review_state.next_review_at).getTime() <= now).length;
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.loadDeck(params.get('deckId') ?? '');
    });
  }

  private async loadDeck(deckId: string): Promise<void> {
    const version = ++this.requestVersion;
    this.deck.set(null);
    this.items.set([]);
    this.errorMessage = '';
    this.loading = true;
    if (!deckId) { this.loading = false; return; }
    try {
      const [deck, items] = await Promise.all([
        this.deckService.getDeck(deckId),
        this.deckService.listDeckItems(deckId),
      ]);
      if (version !== this.requestVersion) return;
      this.deck.set(deck);
      this.items.set(items);
      if (!deck) this.errorMessage = 'This deck is unavailable in the current workspace.';
    } catch (error) {
      if (version === this.requestVersion) this.errorMessage = error instanceof Error ? error.message : 'Unable to load this deck.';
    } finally {
      if (version === this.requestVersion) this.loading = false;
    }
  }

  firstMeaning(item: DeckItem): string {
    return item.custom_meaning || item.lexeme?.senses?.[0]?.translations?.[0]?.translation || item.lexeme?.senses?.[0]?.definition || 'No meaning yet';
  }

  masteryLabel(item: DeckItem): string {
    const mastery = item.review_state?.mastery ?? 0;
    return mastery ? `${Math.round(mastery * 100)}%` : 'New';
  }
}
