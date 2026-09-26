import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Deck, Language } from '../../shared/models/domain.models';
import { DeckService } from './deck.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { differentLanguagesValidator } from '../../shared/utils/language-validation';

@Component({
  selector: 'gv-decks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  template: `
    <div class="page">
      <div class="page-header"><div><p class="eyebrow">Vocabulary spaces</p><h1>My decks</h1><p class="muted">Keep each learning goal small enough to return to.</p></div><span class="status-chip">{{ loadingDecks ? 'Loading…' : decks().length + ' active' }}</span></div>
      <div class="grid grid-2 layout-grid">
        <section class="panel panel-content create-panel">
          <div class="card-header"><div><h2>{{ editingId ? 'Edit deck' : 'Create a deck' }}</h2><p class="muted">Choose the direction you want to practise.</p></div><mat-icon>{{ editingId ? 'edit' : 'add_circle' }}</mat-icon></div>
          <form [formGroup]="form" (ngSubmit)="createDeck()" class="form-grid">
            <mat-form-field appearance="outline"><mat-label>Deck name</mat-label><input matInput formControlName="name" placeholder="Japanese N5" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Description</mat-label><textarea matInput rows="2" formControlName="description" placeholder="Words for my next trip"></textarea></mat-form-field>
            <div class="grid grid-2">
              <mat-form-field appearance="outline"><mat-label>Learning language</mat-label><mat-select formControlName="sourceLanguageId"><mat-option *ngFor="let language of languages()" [value]="language.id">{{ language.name }}</mat-option></mat-select></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Meaning language</mat-label><mat-select formControlName="targetLanguageId"><mat-option *ngFor="let language of languages()" [value]="language.id">{{ language.name }}</mat-option></mat-select></mat-form-field>
            </div>
            <p class="error-text" *ngIf="form.hasError('sameLanguage')">Learning language and meaning language must be different.</p>
            <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
            <div class="form-actions"><button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving || !supabase.configured">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create deck' }}</button><button mat-button type="button" *ngIf="editingId" (click)="cancelEdit()">Cancel</button></div>
          </form>
        </section>
        <section class="deck-list">
          <div class="panel empty-state" *ngIf="loadingDecks"><mat-spinner diameter="32"></mat-spinner><p>Loading decks…</p></div>
          <mat-card *ngFor="let deck of decks()" class="deck-row">
            <mat-card-header><mat-icon mat-card-avatar>style</mat-icon><mat-card-title>{{ deck.name }}</mat-card-title><mat-card-subtitle>{{ languageName(deck.source_language_id) }} → {{ languageName(deck.target_language_id) }}</mat-card-subtitle></mat-card-header>
            <mat-card-content><p>{{ deck.description || 'No description yet.' }}</p></mat-card-content>
            <mat-card-actions><a mat-button color="primary" [routerLink]="['/decks', deck.id]">Open</a><a mat-button [routerLink]="['/decks', deck.id, 'add']">Add words</a><button mat-button type="button" (click)="startEdit(deck)">Edit</button><button mat-button color="warn" type="button" (click)="archiveDeck(deck)">Archive</button></mat-card-actions>
          </mat-card>
          <div class="panel empty-state" *ngIf="!loadingDecks && !decks().length"><mat-icon>style</mat-icon><p>No decks yet. Create one to get started.</p></div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .layout-grid { align-items: start; }
    .create-panel { position: sticky; top: 24px; }
    .form-actions { display: flex; align-items: center; gap: 8px; }
    .deck-list { display: grid; gap: 16px; }
    .deck-row mat-card-content { min-height: 50px; }
    @media (max-width: 800px) { .create-panel { position: static; } }
  `],
})
export class DecksComponent implements OnInit {
  readonly decks = signal<Deck[]>([]);
  readonly languages = signal<Language[]>([]);
  readonly supabase = inject(SupabaseService);
  private readonly deckService = inject(DeckService);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: [''],
    sourceLanguageId: ['', Validators.required],
    targetLanguageId: ['', Validators.required],
  }, { validators: differentLanguagesValidator });
  saving = false;
  loadingDecks = true;
  errorMessage = '';
  editingId: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.languages.set(await this.deckService.loadLanguages());
      if (this.languages().length >= 2) this.form.patchValue({ sourceLanguageId: this.languages()[0].id, targetLanguageId: this.languages()[1].id });
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load decks.';
      this.loadingDecks = false;
    }
  }

  async refresh(): Promise<void> {
    this.loadingDecks = true;
    try {
      this.decks.set(await this.deckService.listDecks());
    } finally {
      this.loadingDecks = false;
    }
  }

  async createDeck(): Promise<void> {
    if (this.form.invalid || !this.supabase.configured) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      const value = this.form.getRawValue();
      const input = { name: value.name, description: value.description || null, source_language_id: value.sourceLanguageId, target_language_id: value.targetLanguageId };
      if (this.editingId) await this.deckService.updateDeck(this.editingId, input);
      else await this.deckService.createDeck(input);
      this.editingId = null;
      this.form.patchValue({ name: '', description: '' });
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to create the deck.';
    } finally {
      this.saving = false;
    }
  }

  startEdit(deck: Deck): void {
    this.editingId = deck.id;
    this.form.patchValue({ name: deck.name, description: deck.description ?? '', sourceLanguageId: deck.source_language_id, targetLanguageId: deck.target_language_id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form.patchValue({ name: '', description: '' });
  }

  async archiveDeck(deck: Deck): Promise<void> {
    if (!this.supabase.configured || !window.confirm(`Archive “${deck.name}”?`)) return;
    try {
      await this.deckService.archiveDeck(deck.id);
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to archive the deck.';
    }
  }

  languageName(id: string): string {
    return this.languages().find((language) => language.id === id)?.name ?? 'Language';
  }
}
