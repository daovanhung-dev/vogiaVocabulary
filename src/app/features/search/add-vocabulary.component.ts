import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, from, map, of, startWith, switchMap, catchError } from 'rxjs';
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
import { parseBatchInput } from '../../shared/utils/normalize';
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
        <mat-form-field appearance="outline" class="full-width"><mat-label>Search a word</mat-label><input matInput [formControl]="searchControl" placeholder="apple, 食べる, 환경…" /><mat-icon matSuffix>search</mat-icon></mat-form-field>
        <div class="batch-row"><mat-form-field appearance="outline" class="full-width"><mat-label>Paste multiple words</mat-label><textarea matInput rows="2" [formControl]="batchControl" placeholder="apple\nbanana\norange"></textarea></mat-form-field><button mat-stroked-button type="button" (click)="runBatch()" [disabled]="loading || !batchControl.value.trim()">Search batch</button></div>
        <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
      </section>

      <section class="results panel" *ngIf="results().length || loading; else searchHint">
        <div class="results-header"><div><p class="eyebrow">Search results</p><h2>{{ results().length }} candidates</h2></div><mat-spinner *ngIf="loading" diameter="28"></mat-spinner></div>
        <ng-container *ngFor="let result of results()">
          <div class="result-row" (click)="toggle(result)" (keydown.enter)="toggle(result)" [class.selected]="isSelected(result)" [class.disabled]="!canImport(result)" [attr.role]="canImport(result) ? 'button' : null" [attr.tabindex]="canImport(result) ? 0 : -1">
            <mat-checkbox [checked]="isSelected(result)" [disabled]="!canImport(result)" (click)="$event.stopPropagation()" (change)="toggle(result)"></mat-checkbox>
            <span class="result-main"><strong>{{ result.term }}</strong><small *ngIf="result.phonetic">{{ result.phonetic }}</small><small *ngIf="result.romanization">{{ result.romanization }}</small></span>
            <span class="result-meaning"><small *ngIf="result.senses[0]?.partOfSpeech" class="result-pos">{{ result.senses[0].partOfSpeech }}</small>{{ meaning(result) }}</span>
            <button mat-icon-button type="button" class="details-button" [attr.aria-label]="'View dictionary details for ' + result.term" [attr.aria-expanded]="isExpanded(result)" (click)="toggleDetails($event, result)"><mat-icon>{{ isExpanded(result) ? 'expand_less' : 'menu_book' }}</mat-icon></button>
          </div>
          <gv-dictionary-details *ngIf="isExpanded(result)" [entry]="dictionaryEntry(result)" [compact]="true"></gv-dictionary-details>
        </ng-container>
        <div class="import-bar" *ngIf="selectedCount"><span>{{ selectedCount }} words ready to add</span><button mat-flat-button color="primary" (click)="importSelected()" [disabled]="importing || !selectedCount">{{ importing ? 'Adding…' : 'Add selected' }}</button></div>
      </section>
      <ng-template #searchHint><div class="panel empty-state"><mat-icon>travel_explore</mat-icon><h3>Search for your next word.</h3><p>Remote search is debounced and cached by the lexicon Edge Function.</p></div></ng-template>
    </div>
  `,
  styles: [`
    .search-panel { margin-bottom: 24px; }
    .language-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; margin-bottom: 18px; border-radius: 999px; background: #edf6f8; color: var(--brand-strong); font-size: .85rem; font-weight: 800; }
    .language-pill mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .batch-row { display: flex; align-items: flex-start; gap: 12px; }
    .batch-row button { margin-top: 4px; min-width: 130px; }
    .results { overflow: hidden; }
    .results-header { display: flex; align-items: center; justify-content: space-between; padding: 24px; border-bottom: 1px solid var(--line); }
    .results-header h2 { margin: 0; }
    .result-row { display: grid; grid-template-columns: 40px minmax(130px, .65fr) minmax(0, 1fr) 42px; gap: 12px; align-items: center; width: 100%; padding: 16px 24px; border-bottom: 1px solid var(--line); background: white; color: var(--ink); text-align: left; cursor: pointer; }
    .result-row:hover, .result-row.selected { background: #f1f8fa; }
    .result-row.disabled { background: #fafafa; color: var(--muted); cursor: not-allowed; }
    .result-row.disabled .result-meaning { color: #9b6b00; }
    .result-main { display: grid; gap: 3px; }
    .result-main small, .result-meaning { color: var(--muted); }
    .result-meaning { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-pos { display: inline-block; margin-right: 7px; color: var(--brand-strong); font-style: italic; font-weight: 700; }
    .details-button { color: var(--brand-strong); }
    .import-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: #fff8e5; color: #704f00; font-weight: 700; }
    @media (max-width: 700px) { .batch-row { align-items: stretch; flex-direction: column; } .batch-row button { margin: 0; } .result-row { grid-template-columns: 36px minmax(100px, 1fr) 30px; padding: 14px 16px; } .result-meaning { display: none; } }
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
  importing = false;
  errorMessage = '';

  get selectedCount(): number { return Object.keys(this.selected()).length; }
  get sourceLanguageName(): string { return this.languageName(this.deck()?.source_language_id); }
  get targetLanguageName(): string { return this.languageName(this.deck()?.target_language_id); }

  async ngOnInit(): Promise<void> {
    const deckId = this.route.snapshot.paramMap.get('deckId');
    if (!deckId) return;
    this.deck.set(await this.deckService.getDeck(deckId));
    this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => value.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      filter((value) => value.length >= 2),
      switchMap((query) => {
        this.loading = true;
        this.errorMessage = '';
        this.results.set([]);
        this.selected.set({});
        this.expanded.set({});
        const mismatch = languageMismatchMessage(query, this.sourceCode, this.targetCode);
        if (mismatch) {
          this.errorMessage = mismatch;
          return of([]);
        }
        return from(this.searchService.search({ query, sourceLanguage: this.sourceCode, targetLanguage: this.targetCode })).pipe(
          catchError((error: unknown) => { this.errorMessage = error instanceof Error ? error.message : 'Search failed.'; return of([]); }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((results) => { this.results.set(results); this.loading = false; });
  }

  get sourceCode(): string { return this.deck()?.source_language?.code ?? 'en'; }
  get targetCode(): string { return this.deck()?.target_language?.code ?? 'vi'; }

  async runBatch(): Promise<void> {
    const queries = parseBatchInput(this.batchControl.value);
    if (!queries.length) return;
    const mismatch = queries.map((query) => languageMismatchMessage(query, this.sourceCode, this.targetCode)).find(Boolean);
    if (mismatch) {
      this.results.set([]);
      this.selected.set({});
      this.expanded.set({});
      this.errorMessage = mismatch;
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.results.set([]);
    this.selected.set({});
    this.expanded.set({});
    try {
      const grouped = await this.searchService.searchBatch(queries, this.sourceCode, this.targetCode);
      const batchResults = queries.flatMap((query) => grouped[query] ?? []);
      this.results.set(batchResults);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Batch search failed.';
    } finally {
      this.loading = false;
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
    const deckId = this.route.snapshot.paramMap.get('deckId');
    const items = Object.values(this.selected()).filter((item) => this.canImport(item));
    if (!deckId || !items.length) {
      this.errorMessage = 'Select a vocabulary item with a definition before adding it.';
      return;
    }
    this.importing = true;
    this.errorMessage = '';
    try {
      await this.searchService.importSelected(deckId, items);
      await this.router.navigate(['/decks', deckId, 'vocabulary']);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Import failed.';
    } finally {
      this.importing = false;
    }
  }

  private languageName(id: string | undefined): string { return this.deckService.languages().find((language) => language.id === id)?.name ?? 'Language'; }
}
