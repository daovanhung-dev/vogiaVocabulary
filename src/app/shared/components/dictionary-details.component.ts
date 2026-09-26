import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DictionaryViewEntry } from '../utils/dictionary';

@Component({
  selector: 'gv-dictionary-details',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <section class="dictionary-details" *ngIf="entry" [class.compact]="compact">
      <div class="dictionary-meta">
        <span class="pronunciation" *ngIf="entry.phonetic"><strong>IPA</strong> {{ entry.phonetic }}</span>
        <span class="pronunciation" *ngIf="entry.romanization"><strong>Romanization</strong> {{ entry.romanization }}</span>
        <audio *ngIf="entry.audioUrl" controls preload="none" [src]="entry.audioUrl" [attr.aria-label]="'Play pronunciation of ' + entry.term"></audio>
        <a *ngIf="entry.sourceReference" mat-button class="source-link" [href]="entry.sourceReference" target="_blank" rel="noopener noreferrer">
          <mat-icon>open_in_new</mat-icon> Wiktionary source
        </a>
      </div>

      <p class="missing-meta" *ngIf="!entry.phonetic && !entry.romanization">Pronunciation is not available for this entry.</p>
      <p class="custom-meaning" *ngIf="entry.customMeaning"><strong>Your meaning:</strong> {{ entry.customMeaning }}</p>

      <div class="sense" *ngFor="let sense of entry.senses; let index = index">
        <div class="sense-heading">
          <span class="sense-number">{{ index + 1 }}</span>
          <span class="part-of-speech" *ngIf="sense.partOfSpeech">{{ sense.partOfSpeech }}</span>
        </div>
        <p class="definition">{{ sense.definition }}</p>
        <div class="translations" *ngIf="sense.translations.length">
          <span class="section-label">Meaning / translation</span>
          <span class="translation" *ngFor="let translation of sense.translations">
            {{ translation.value }}<small *ngIf="translation.romanization"> · {{ translation.romanization }}</small>
          </span>
        </div>
        <div class="examples" *ngIf="sense.examples.length">
          <span class="section-label">Examples</span>
          <div class="example" *ngFor="let example of sense.examples">
            <span>{{ example.sentence }}</span>
            <small *ngIf="example.translation">{{ example.translation }}</small>
          </div>
        </div>
      </div>

      <p class="missing-meta" *ngIf="!entry.senses.length">No dictionary definition is available for this entry.</p>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .dictionary-details { display: grid; gap: 14px; padding: 18px 24px 22px; background: #f8fbfc; border-bottom: 1px solid var(--line); }
    .dictionary-details.compact { padding: 16px 24px 20px 76px; }
    .dictionary-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; color: var(--muted); font-size: .9rem; }
    .pronunciation { display: inline-flex; gap: 6px; align-items: center; }
    .pronunciation strong { color: var(--brand-strong); font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; }
    audio { width: 230px; height: 32px; }
    .source-link { min-height: 32px; padding: 0 8px; }
    .source-link mat-icon { width: 16px; height: 16px; margin-right: 4px; font-size: 16px; }
    .missing-meta { margin: 0; color: var(--muted); font-size: .88rem; }
    .custom-meaning { margin: 0; color: var(--ink); }
    .sense { display: grid; gap: 7px; padding-top: 12px; border-top: 1px solid #dce8eb; }
    .sense-heading { display: flex; align-items: center; gap: 8px; }
    .sense-number { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #d9edf0; color: var(--brand-strong); font-size: .78rem; font-weight: 800; }
    .part-of-speech { color: var(--brand-strong); font-size: .82rem; font-style: italic; font-weight: 700; text-transform: lowercase; }
    .definition { margin: 0; color: var(--ink); line-height: 1.5; }
    .translations, .examples { display: grid; gap: 5px; }
    .section-label { color: var(--muted); font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .translation { color: #245f67; font-weight: 700; }
    .translation small, .example small { color: var(--muted); font-weight: 400; }
    .example { display: grid; gap: 2px; padding-left: 12px; border-left: 2px solid #b7dce0; line-height: 1.45; }
    @media (max-width: 700px) { .dictionary-details.compact { padding-left: 16px; } audio { width: min(100%, 230px); } }
  `],
})
export class DictionaryDetailsComponent {
  @Input({ required: true }) entry: DictionaryViewEntry | null = null;
  @Input() compact = false;
}
