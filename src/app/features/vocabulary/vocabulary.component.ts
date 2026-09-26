import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DeckItem } from '../../shared/models/domain.models';
import { DeckService } from '../decks/deck.service';

type VocabularyFilter = 'all' | 'new' | 'learning' | 'mastered' | 'weak' | 'due';

@Component({
  selector: 'gv-vocabulary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="page">
      <a mat-button [routerLink]="['/decks', deckId]"><mat-icon>arrow_back</mat-icon>{{ deckName }}</a>
      <div class="page-header"><div><p class="eyebrow">Vocabulary library</p><h1>Words worth keeping</h1><p class="muted">Review, search and filter the words in this deck.</p></div><a mat-flat-button color="primary" [routerLink]="['/decks', deckId, 'add']"><mat-icon>add</mat-icon>Add words</a></div>
      <section class="panel panel-content toolbar-card"><mat-form-field appearance="outline"><mat-label>Search this deck</mat-label><input matInput [formControl]="searchControl" placeholder="term or meaning" /><mat-icon matSuffix>search</mat-icon></mat-form-field><mat-form-field appearance="outline"><mat-label>Filter</mat-label><mat-select [value]="filter()" (selectionChange)="filter.set($event.value)"><mat-option value="all">All words</mat-option><mat-option value="new">New</mat-option><mat-option value="learning">Learning</mat-option><mat-option value="mastered">Mastered</mat-option><mat-option value="weak">Weak</mat-option><mat-option value="due">Due today</mat-option></mat-select></mat-form-field></section>
      <section class="panel vocabulary-table" *ngIf="filteredItems.length; else emptyState"><div class="table-head"><span>Word</span><span>Meaning</span><span>Progress</span><span></span></div><div class="vocab-row" *ngFor="let item of filteredItems"><div><strong>{{ item.lexeme?.term }}</strong><small *ngIf="item.lexeme?.romanization">{{ item.lexeme?.romanization }}</small></div><span>{{ meaning(item) }}</span><span><strong>{{ progress(item) }}</strong><small>{{ progressLabel(item) }}</small></span><button mat-icon-button color="warn" type="button" aria-label="Remove word" (click)="remove(item)"><mat-icon>delete_outline</mat-icon></button></div></section>
      <ng-template #emptyState><div class="panel empty-state"><mat-icon>menu_book</mat-icon><h3>No words match this view.</h3><p>Add words from Wiktionary or change the filter.</p><a mat-stroked-button [routerLink]="['/decks', deckId, 'add']">Add vocabulary</a></div></ng-template>
    </div>
  `,
  styles: [`
    .toolbar-card { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 16px; margin-bottom: 20px; }
    .vocabulary-table { overflow: hidden; }
    .table-head, .vocab-row { display: grid; grid-template-columns: minmax(120px, .7fr) minmax(0, 1.4fr) 120px 42px; gap: 20px; align-items: center; padding: 16px 24px; }
    .table-head { background: #f8fafc; color: var(--muted); font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .vocab-row { border-top: 1px solid var(--line); }
    .vocab-row div, .vocab-row > span:last-child { display: grid; gap: 4px; }
    .vocab-row small { color: var(--muted); }
    @media (max-width: 700px) { .toolbar-card { grid-template-columns: 1fr; } .table-head { display: none; } .vocab-row { grid-template-columns: 1fr auto; padding: 18px 16px; } .vocab-row > span:nth-child(2) { grid-column: 1 / -1; grid-row: 2; } }
  `],
})
export class VocabularyComponent implements OnInit {
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly items = signal<DeckItem[]>([]);
  readonly filter = signal<VocabularyFilter>('all');
  private readonly route = inject(ActivatedRoute);
  private readonly deckService = inject(DeckService);

  get deckId(): string { return this.route.snapshot.paramMap.get('deckId') ?? ''; }
  get deckName(): string { return 'Deck vocabulary'; }

  get filteredItems(): DeckItem[] {
    const query = this.searchControl.value.trim().toLocaleLowerCase();
    const now = Date.now();
    return this.items().filter((item) => {
      const text = `${item.lexeme?.term ?? ''} ${this.meaning(item)}`.toLocaleLowerCase();
      if (query && !text.includes(query)) return false;
      const mastery = item.review_state?.mastery ?? 0;
      if (this.filter() === 'new') return !item.review_state || mastery === 0;
      if (this.filter() === 'learning') return mastery > 0 && mastery < 0.8;
      if (this.filter() === 'mastered') return mastery >= 0.8;
      if (this.filter() === 'weak') return mastery < 0.4;
      if (this.filter() === 'due') return !item.review_state?.next_review_at || new Date(item.review_state.next_review_at).getTime() <= now;
      return true;
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.deckId) this.items.set(await this.deckService.listDeckItems(this.deckId));
  }

  async remove(item: DeckItem): Promise<void> {
    if (!window.confirm(`Remove “${item.lexeme?.term ?? 'this word'}” from the deck?`)) return;
    await this.deckService.removeDeckItem(item.id);
    this.items.update((items) => items.filter((current) => current.id !== item.id));
  }

  meaning(item: DeckItem): string { return item.custom_meaning || item.lexeme?.senses?.[0]?.translations?.[0]?.translation || item.lexeme?.senses?.[0]?.definition || 'No meaning yet'; }
  progress(item: DeckItem): string { return `${Math.round((item.review_state?.mastery ?? 0) * 100)}%`; }
  progressLabel(item: DeckItem): string { return item.review_state?.mastery && item.review_state.mastery >= .8 ? 'Mastered' : item.review_state?.mastery ? 'Learning' : 'New'; }
}
