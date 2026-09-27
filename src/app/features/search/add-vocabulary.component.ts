import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, from, map, of, startWith, switchMap, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Deck, LexiconSearchResult } from '../../shared/models/domain.models';
import { DictionaryDetailsComponent } from '../../shared/components/dictionary-details.component';
import { DictionaryViewEntry, fromLexiconResult } from '../../shared/utils/dictionary';
import { DeckService } from '../decks/deck.service';
import { SearchService } from './search.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { parseBatchInput, uniqueByNormalizedTerm } from '../../shared/utils/normalize';
import { hasImportableDefinition, languageMismatchMessage } from '../../shared/utils/language-compat';

@Component({
  selector: 'gv-add-vocabulary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DictionaryDetailsComponent, MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="page">
      <a mat-button routerLink="/decks"><mat-icon>arrow_back</mat-icon>All decks</a>
      <div class="page-header"><div><p class="eyebrow">{{ deck()?.name }}</p><h1>Add vocabulary</h1><p class="muted">Search {{ sourceLanguageName }} words and save the ones worth revisiting.</p></div><span class="status-chip">{{ selectedCount }} selected</span></div>
      <section class="panel panel-content search-panel">
        <div class="language-pill">{{ sourceLanguageName }} <mat-icon>arrow_forward</mat-icon> {{ targetLanguageName }}</div>
        <mat-form-field appearance="outline" class="full-width"><mat-label>Search a word</mat-label><input matInput [formControl]="searchControl" [disabled]="loadingDeck" placeholder="apple, 食べる, 환경…" /><mat-hint>Type at least 2 characters to search.</mat-hint><mat-icon matSuffix>search</mat-icon></mat-form-field>
        <div class="batch-row"><mat-form-field appearance="outline" class="full-width"><mat-label>Paste multiple words</mat-label><textarea matInput rows="2" [formControl]="batchControl" placeholder="apple\nbanana\norange"></textarea></mat-form-field><button mat-stroked-button type="button" (click)="runBatch()" [disabled]="loading || !batchControl.value.trim()">Search batch</button></div>
        <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
      </section>

      <section class="results panel" *ngIf="results().length || loading; else searchHint">
        <div class="results-header"><div><p class="eyebrow">Search results</p><h2>{{ results().length }} candidates</h2></div><mat-spinner *ngIf="loading" diameter="28"></mat-spinner></div>
        <ng-container *ngFor="let result of results()">
          <div class="result-row" (click)="toggle(result)" [class.selected]="isSelected(result)" [class.disabled]="!canImport(result)">
            <mat-checkbox [checked]="isSelected(result)" [disabled]="!canImport(result)" (click)="$event.stopPropagation()" (change)="toggle(result)"></mat-checkbox>
            <span class="result-main"><strong>{{ result.term }}</strong><small *ngIf="result.phonetic">{{ result.phonetic }}</small><small *ngIf="result.romanization">{{ result.romanization }}</small></span>
            <span class="result-meaning"><small *ngIf="result.senses[0]?.partOfSpeech" class="result-pos">{{ result.senses[0].partOfSpeech }}</small>{{ meaning(result) }}</span>
            <button mat-icon-button type="button" class="details-button" [attr.aria-label]="'View dictionary details for ' + result.term" [attr.aria-expanded]="isExpanded(result)" (click)="toggleDetails($event, result)"><mat-icon>{{ isExpanded(result) ? 'expand_less' : 'menu_book' }}</mat-icon></button>
          </div>
          <gv-dictionary-details *ngIf="isExpanded(result)" [entry]="dictionaryEntry(result)" [compact]="true"></gv-dictionary-details>
        </ng-container>
        <div class="import-bar" *ngIf="selectedCount"><span>{{ selectedCount }} words ready to add</span><button mat-flat-button color="primary" (click)="importSelected()" [disabled]="importing || !selectedCount">{{ importing ? 'Adding…' : 'Add selected' }}</button></div>
      </section>
      <ng-template #searchHint>
        <div class="panel empty-state" *ngIf="hasSearched && !errorMessage"><mat-icon>search_off</mat-icon><h3>No words found yet.</h3><p>Try another spelling or check the language pair for this deck.</p></div>
        <div class="panel empty-state error-state" *ngIf="hasSearched && errorMessage"><mat-icon>cloud_off</mat-icon><h3>Search could not finish.</h3><p>Check your connection and try again.</p></div>
        <div class="panel empty-state" *ngIf="!hasSearched"><mat-icon>travel_explore</mat-icon><h3>Search for your next word.</h3><p>Look up a single word or paste a list to search in one go.</p></div>
      </ng-template>
    </div>
  `,
  styles: [`
    .search-panel { margin-bottom: 24px; }
    .language-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; margin-bottom: 18px; border-radius: 999px; background: #edf6f8; color: var(--brand-strong); font-size: .85rem; font-weight: 800; }
    .language-pill mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .batch-row { display: flex; align-items: flex-start; gap: 12px; }
    .batch-row button { margin-top: 4px; min-width: 130px; }
    .results { overflow: hidden; }
    .error-state mat-icon { color: var(--coral); }
    .results-header { display: flex; align-items: center; justify-content: space-between; padding: 24px; border-bottom: 1px solid var(--line); }
    .results-header h2 { margin: 0; }
    .result-row { display: grid; grid-template-columns: 40px minmax(130px, .65fr) minmax(0, 1fr) 42px; gap: 12px; align-items: center; width: 100%; padding: 16px 24px; border-bottom: 1px solid var(--line); background: white; color: var(--ink); text-align: left; cursor: pointer; transition: background .16s ease; animation: card-enter .3s ease both; }
    .result-row:hover, .result-row.selected { background: #f1f8fa; }
    .result-row.disabled { background: #fafafa; color: var(--muted); cursor: not-allowed; }
    .result-row.disabled .result-meaning { color: #9b6b00; }
    .result-main { display: grid; gap: 3px; }
    .result-main small, .result-meaning { color: var(--muted); }
    .result-meaning { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-pos { display: inline-block; margin-right: 7px; color: var(--brand-strong); font-style: italic; font-weight: 700; }
    .details-button { color: var(--brand-strong); }
    .import-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: #fff8e5; color: #704f00; font-weight: 700; }
    @media (max-width: 700px) {
      .batch-row { align-items: stretch; flex-direction: column; }
      .batch-row button { margin: 0; }
      .result-row { grid-template-columns: 36px minmax(0, 1fr) 42px; gap: 8px; padding: 14px 16px; }
      .result-main { grid-column: 2; grid-row: 1; min-width: 0; }
      .result-meaning { display: block; grid-column: 2 / -1; grid-row: 2; overflow: visible; white-space: normal; line-height: 1.45; }
      .details-button { grid-column: 3; grid-row: 1; }
      .result-row > mat-checkbox { grid-column: 1; grid-row: 1 / 3; }
    }
  `],
})
export class AddVocabularyComponent implements OnInit {
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly batchControl = new FormControl('', { nonNullable: true });
  readonly results = signal<LexiconSearchResult[]>([]);
  readonly selected = signal<Record<string, LexiconSearchResult>>({});
  readonly expanded = signal<Record<string, boolean>>({});
  readonly deck = signal<Deck | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly deckService = inject(DeckService);
  private readonly searchService = inject(SearchService);
  private readonly destroyRef = inject(DestroyRef);
  readonly supabase = inject(SupabaseService);
  loading = false;
  loadingDeck = false;
  importing = false;
  errorMessage = '';
  hasSearched = false;
  private activeDeckId = '';
  private routeLoadToken = 0;
  private searchVersion = 0;

  get selectedCount(): number { return Object.keys(this.selected()).length; }
  get sourceLanguageName(): string { return this.languageName(this.deck()?.source_language_id); }
  get targetLanguageName(): string { return this.languageName(this.deck()?.target_language_id); }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const deckId = params.get('deckId') ?? '';
      this.activeDeckId = deckId;
      this.searchVersion += 1;
      this.deck.set(null);
      this.results.set([]);
      this.selected.set({});
      this.expanded.set({});
      this.errorMessage = '';
      this.hasSearched = false;
      this.loading = false;
      this.importing = false;
      this.searchControl.setValue('');
      this.batchControl.setValue('');
      void this.loadDeck(deckId);
    });

    this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => value.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        const requestId = ++this.searchVersion;
        if (query.length < 2) {
          this.loading = false;
          this.hasSearched = false;
          this.errorMessage = '';
          this.results.set([]);
          this.selected.set({});
          this.expanded.set({});
          return of({ requestId, results: [] as LexiconSearchResult[] });
        }
        this.loading = true;
        this.hasSearched = true;
        this.errorMessage = '';
        this.results.set([]);
        this.selected.set({});
        this.expanded.set({});
        const mismatch = languageMismatchMessage(query, this.sourceCode, this.targetCode);
        if (mismatch) {
          this.errorMessage = mismatch;
          return of({ requestId, results: [] as LexiconSearchResult[] });
        }
        return from(this.searchService.search({ query, sourceLanguage: this.sourceCode, targetLanguage: this.targetCode })).pipe(
          map((results) => ({ requestId, results })),
          catchError((error: unknown) => {
            if (requestId === this.searchVersion) this.errorMessage = error instanceof Error ? error.message : 'Search failed.';
            return of({ requestId, results: [] as LexiconSearchResult[] });
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ requestId, results }) => {
      if (requestId !== this.searchVersion) return;
      this.results.set(results);
      this.loading = false;
    });
  }

  get sourceCode(): string { return this.deck()?.source_language?.code ?? 'en'; }
  get targetCode(): string { return this.deck()?.target_language?.code ?? 'vi'; }

  private async loadDeck(deckId: string): Promise<void> {
    const requestId = ++this.routeLoadToken;
    if (!deckId) { this.loadingDeck = false; return; }
    this.loadingDeck = true;
    try {
      const deck = await this.deckService.getDeck(deckId);
      if (requestId !== this.routeLoadToken) return;
      this.deck.set(deck);
      if (!deck) this.errorMessage = 'This deck could not be found.';
    } catch (error) {
      if (requestId === this.routeLoadToken) this.errorMessage = error instanceof Error ? error.message : 'Unable to load this deck.';
    } finally {
      if (requestId === this.routeLoadToken) this.loadingDeck = false;
    }
  }

  async runBatch(): Promise<void> {
    const queries = parseBatchInput(this.batchControl.value);
    if (!queries.length) return;
    this.searchVersion += 1;
    this.searchControl.setValue('', { emitEvent: false });
    const requestId = this.searchVersion;
    const mismatch = queries.map((query) => languageMismatchMessage(query, this.sourceCode, this.targetCode)).find(Boolean);
    this.hasSearched = true;
    this.loading = false;
    this.errorMessage = '';
    if (mismatch) {
      this.results.set([]);
      this.selected.set({});
      this.expanded.set({});
      this.errorMessage = mismatch;
      return;
    }
    this.loading = true;
    this.hasSearched = true;
    this.errorMessage = '';
    this.results.set([]);
    this.selected.set({});
    this.expanded.set({});
    try {
      const grouped = await this.searchService.searchBatch(queries, this.sourceCode, this.targetCode);
      const batchResults = queries.flatMap((query) => grouped[query] ?? []);
      const uniqueResults = uniqueByNormalizedTerm(batchResults);
      if (requestId !== this.searchVersion) return;
      this.results.set(uniqueResults);
    } catch (error) {
      if (requestId !== this.searchVersion) return;
      this.errorMessage = error instanceof Error ? error.message : 'Batch search failed.';
    } finally {
      if (requestId === this.searchVersion) this.loading = false;
    }
  }

  toggle(result: LexiconSearchResult): void {
    if (!this.canImport(result)) return;
    const next = { ...this.selected() };
    if (next[result.normalizedTerm]) delete next[result.normalizedTerm];
    else next[result.normalizedTerm] = result;
    this.selected.set(next);
  }

  isSelected(result: LexiconSearchResult): boolean { return Boolean(this.selected()[result.normalizedTerm]); }

  isExpanded(result: LexiconSearchResult): boolean { return Boolean(this.expanded()[result.normalizedTerm]); }

  toggleDetails(event: Event, result: LexiconSearchResult): void {
    event.stopPropagation();
    if (!result.senses.length && !result.phonetic && !result.romanization && !result.audioUrl) return;
    this.expanded.update((current) => ({ ...current, [result.normalizedTerm]: !current[result.normalizedTerm] }));
  }

  dictionaryEntry(result: LexiconSearchResult): DictionaryViewEntry { return fromLexiconResult(result); }

  canImport(result: LexiconSearchResult): boolean {
    return hasImportableDefinition(result);
  }

  meaning(result: LexiconSearchResult): string {
    return result.senses?.[0]?.translations?.[0]?.translation || result.senses?.[0]?.definition || 'No definition available for this language';
  }

  async importSelected(): Promise<void> {
    const deckId = this.activeDeckId;
    const routeVersion = this.routeLoadToken;
    const items = Object.values(this.selected()).filter((item) => this.canImport(item));
    if (!deckId || !items.length) {
      this.errorMessage = 'Select a vocabulary item with a definition before adding it.';
      return;
    }
    this.importing = true;
    this.errorMessage = '';
    try {
      await this.searchService.importSelected(deckId, items);
      if (routeVersion !== this.routeLoadToken) return;
      await this.router.navigate(['/decks', deckId, 'vocabulary']);
    } catch (error) {
      if (routeVersion === this.routeLoadToken) {
        this.errorMessage = error instanceof Error ? error.message : 'Import failed.';
      }
    } finally {
      if (routeVersion === this.routeLoadToken) this.importing = false;
    }
  }

  private languageName(id: string | undefined): string { return this.deckService.languages().find((language) => language.id === id)?.name ?? 'Language'; }
}
