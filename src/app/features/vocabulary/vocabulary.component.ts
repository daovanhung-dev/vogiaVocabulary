import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Deck, DeckItem } from '../../shared/models/domain.models';
import { DictionaryDetailsComponent } from '../../shared/components/dictionary-details.component';
import { DeckService } from '../decks/deck.service';
import { DictionaryViewEntry, firstDictionaryMeaning, fromDeckItem } from '../../shared/utils/dictionary';

type VocabularyFilter = 'all' | 'new' | 'learning' | 'mastered' | 'weak' | 'due';

@Component({
  selector: 'gv-vocabulary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DictionaryDetailsComponent, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="page">
      <a mat-button [routerLink]="['/decks', deckId]"><mat-icon>arrow_back</mat-icon>{{ deckName }}</a>
      <div class="page-header"><div><p class="eyebrow">Vocabulary library</p><h1>Words worth keeping</h1><p class="muted">Review, search and filter the words in this deck.</p></div><a mat-flat-button color="primary" [routerLink]="['/decks', deckId, 'add']"><mat-icon>add</mat-icon>Add words</a></div>
      <section class="panel panel-content toolbar-card"><mat-form-field appearance="outline"><mat-label>Search this deck</mat-label><input matInput [formControl]="searchControl" placeholder="term or meaning" /><mat-icon matSuffix>search</mat-icon></mat-form-field><mat-form-field appearance="outline"><mat-label>Filter</mat-label><mat-select [value]="filter()" (selectionChange)="filter.set($event.value)"><mat-option value="all">All words</mat-option><mat-option value="new">New</mat-option><mat-option value="learning">Learning</mat-option><mat-option value="mastered">Mastered</mat-option><mat-option value="weak">Weak</mat-option><mat-option value="due">Due today</mat-option></mat-select></mat-form-field></section>
      <section class="panel empty-state" *ngIf="loading" role="status"><mat-icon class="loading-icon">autorenew</mat-icon><p>Loading your vocabulary…</p></section>
      <section class="panel vocabulary-table" *ngIf="!loading && filteredItems.length; else emptyState"><div class="table-head"><span>Word</span><span>Meaning</span><span>Progress</span><span></span></div><ng-container *ngFor="let item of filteredItems"><div class="vocab-row"><div><strong>{{ item.lexeme?.term }}</strong><small *ngIf="item.lexeme?.phonetic">{{ item.lexeme?.phonetic }}</small><small *ngIf="item.lexeme?.romanization">{{ item.lexeme?.romanization }}</small></div><span><small class="part-of-speech" *ngIf="item.lexeme?.senses?.[0]?.part_of_speech">{{ item.lexeme?.senses?.[0]?.part_of_speech }}</small>{{ meaning(item) }}</span><span><strong>{{ progress(item) }}</strong><small>{{ progressLabel(item) }}</small></span><div class="vocab-actions"><button mat-icon-button type="button" [attr.aria-label]="'View dictionary details for ' + item.lexeme?.term" [attr.aria-expanded]="isExpanded(item)" (click)="toggleDetails(item)"><mat-icon>{{ isExpanded(item) ? 'expand_less' : 'menu_book' }}</mat-icon></button><button mat-icon-button color="warn" type="button" aria-label="Remove word" (click)="remove(item)"><mat-icon>delete_outline</mat-icon></button></div></div><gv-dictionary-details *ngIf="isExpanded(item)" [entry]="dictionaryEntry(item)"></gv-dictionary-details></ng-container></section>
      <ng-template #emptyState><div class="panel empty-state" *ngIf="!loading"><mat-icon>{{ loadError ? 'cloud_off' : 'menu_book' }}</mat-icon><h3>{{ loadError ? 'Vocabulary could not be loaded.' : items().length ? 'No words match this view.' : 'This deck is ready for its first word.' }}</h3><p>{{ loadError || (items().length ? 'Try another search or filter to find your words.' : 'Add words from the dictionary, then come back to practise.') }}</p><a mat-stroked-button [routerLink]="['/decks', deckId, 'add']">Add vocabulary</a></div></ng-template>
    </div>
  `,
  styles: [`
    .toolbar-card { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 16px; margin-bottom: 20px; }
    .vocabulary-table { overflow: hidden; }
    .table-head, .vocab-row { display: grid; grid-template-columns: minmax(120px, .7fr) minmax(0, 1.4fr) 120px 84px; gap: 20px; align-items: center; padding: 16px 24px; }
    .table-head { background: #f8fafc; color: var(--muted); font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .vocab-row { border-top: 1px solid var(--line); }
    .vocab-row > div:not(.vocab-actions), .vocab-row > span { display: grid; gap: 4px; }
    .vocab-actions { display: flex; justify-content: flex-end; gap: 2px; }
    .part-of-speech { color: var(--brand-strong); font-style: italic; }
    .vocab-row small { color: var(--muted); }
    .loading-icon { animation: mascot-float 1.4s ease-in-out infinite; }
    @media (max-width: 700px) { .toolbar-card { grid-template-columns: 1fr; } .table-head { display: none; } .vocab-row { grid-template-columns: 1fr auto; padding: 18px 16px; } .vocab-row > span:nth-child(2) { grid-column: 1 / -1; grid-row: 2; } }
  `],
})
export class VocabularyComponent implements OnInit {
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly items = signal<DeckItem[]>([]);
  readonly filter = signal<VocabularyFilter>('all');
  readonly expanded = signal<Record<string, boolean>>({});
  readonly deck = signal<Deck | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly deckService = inject(DeckService);
  private readonly destroyRef = inject(DestroyRef);
  loading = true;
  loadError = '';
  private requestVersion = 0;

  get deckId(): string { return this.route.snapshot.paramMap.get('deckId') ?? ''; }
  get deckName(): string { return this.deck()?.name ?? 'Deck vocabulary'; }

  get filteredItems(): DeckItem[] {
    const query = this.searchControl.value.trim().toLocaleLowerCase();
    const now = Date.now();
    return this.items().filter((item) => {
      const text = this.searchableText(item);
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

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.loadDeck(params.get('deckId') ?? '');
    });
  }

  private async loadDeck(deckId: string): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.loadError = '';
    this.deck.set(null);
    this.items.set([]);
    this.expanded.set({});
    this.searchControl.setValue('');
    this.filter.set('all');
    try {
      const [deck, items] = await Promise.all([
        this.deckService.getDeck(deckId),
        this.deckService.listDeckItems(deckId),
      ]);
      if (version !== this.requestVersion) return;
      this.deck.set(deck);
      this.items.set(items);
      if (!deck) this.loadError = 'This deck is unavailable in the current workspace.';
    } catch (error) {
      if (version === this.requestVersion) this.loadError = error instanceof Error ? error.message : 'Unable to load deck vocabulary.';
    } finally {
      if (version === this.requestVersion) this.loading = false;
    }
  }

  async remove(item: DeckItem): Promise<void> {
    if (!window.confirm(`Remove “${item.lexeme?.term ?? 'this word'}” from the deck?`)) return;
    await this.deckService.removeDeckItem(item.id);
    this.items.update((items) => items.filter((current) => current.id !== item.id));
    this.expanded.update((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  isExpanded(item: DeckItem): boolean { return Boolean(this.expanded()[item.id]); }

  toggleDetails(item: DeckItem): void { this.expanded.update((current) => ({ ...current, [item.id]: !current[item.id] })); }

  dictionaryEntry(item: DeckItem): DictionaryViewEntry { return fromDeckItem(item); }

  meaning(item: DeckItem): string { return firstDictionaryMeaning(this.dictionaryEntry(item)); }

  searchableText(item: DeckItem): string {
    const entry = this.dictionaryEntry(item);
    return [
      entry.term,
      entry.customMeaning,
      ...entry.senses.flatMap((sense) => [sense.definition, ...sense.translations.map((translation) => translation.value)]),
    ].filter(Boolean).join(' ').toLocaleLowerCase();
  }
  progress(item: DeckItem): string { return `${Math.round((item.review_state?.mastery ?? 0) * 100)}%`; }
  progressLabel(item: DeckItem): string { return item.review_state?.mastery && item.review_state.mastery >= .8 ? 'Mastered' : item.review_state?.mastery ? 'Learning' : 'New'; }
}
