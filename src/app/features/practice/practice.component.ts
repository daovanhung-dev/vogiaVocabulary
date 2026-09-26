import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  DeckItem,
  ExerciseDifficulty,
  ExerciseDirection,
  ExerciseGenerationResponse,
  ExerciseType,
  PracticeQuestion,
} from '../../shared/models/domain.models';
import { DeckService } from '../decks/deck.service';
import { PracticeService } from './practice.service';

interface ModeOption {
  value: ExerciseType;
  label: string;
  group: 'choice' | 'text' | 'reveal' | 'matching';
}

interface MatchingPair {
  left: string;
  right: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'multiple_choice_meaning', label: 'Choose the meaning', group: 'choice' },
  { value: 'multiple_choice_term', label: 'Choose the word', group: 'choice' },
  { value: 'true_false', label: 'True or false', group: 'choice' },
  { value: 'context_choice', label: 'Context choice', group: 'choice' },
  { value: 'odd_one_out', label: 'Odd one out', group: 'choice' },
  { value: 'example_choice', label: 'Choose the example', group: 'choice' },
  { value: 'typing_meaning', label: 'Type the meaning', group: 'text' },
  { value: 'typing_term', label: 'Type the word', group: 'text' },
  { value: 'translation', label: 'Translate', group: 'text' },
  { value: 'reverse_translation', label: 'Reverse translation', group: 'text' },
  { value: 'fill_blank', label: 'Fill the blank', group: 'text' },
  { value: 'scrambled_letters', label: 'Unscramble letters', group: 'text' },
  { value: 'flashcard', label: 'Flashcard recall', group: 'reveal' },
  { value: 'matching_pairs', label: 'Match pairs', group: 'matching' },
  { value: 'context_cloze', label: 'Context cloze', group: 'text' },
];

@Component({
  selector: 'gv-practice',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <div class="page">
      <a mat-button [routerLink]="['/decks', deckId]"><mat-icon>arrow_back</mat-icon>Back to deck</a>

      <section class="panel setup-card" *ngIf="loading">
        <mat-spinner diameter="36"></mat-spinner>
        <p class="muted">Loading your vocabulary…</p>
      </section>

      <ng-container *ngIf="!loading && phase === 'setup'">
        <section class="page-header"><div><p class="eyebrow">AI practice studio</p><h1>{{ deckName }}</h1><p class="muted">Create a focused set from {{ deckItems().length }} saved words.</p></div><span class="status-chip">10–100 questions</span></section>
        <section class="panel setup-card">
          <div class="setup-grid">
            <mat-form-field appearance="outline"><mat-label>Number of questions</mat-label><input matInput type="number" min="10" max="100" [formControl]="countControl" /><mat-hint>Choose between 10 and 100.</mat-hint></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Difficulty</mat-label><mat-select [formControl]="difficultyControl"><mat-option value="easy">Easy</mat-option><mat-option value="adaptive">Adaptive</mat-option><mat-option value="hard">Hard</mat-option></mat-select></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Direction</mat-label><mat-select [formControl]="directionControl"><mat-option value="source_to_target">Word → meaning</mat-option><mat-option value="target_to_source">Meaning → word</mat-option></mat-select></mat-form-field>
          </div>

          <div class="mode-header"><div><p class="eyebrow">Game mix</p><h2>How should you practise?</h2><p class="muted">Leave all modes unselected for an automatic mix.</p></div><button mat-button type="button" (click)="clearModes()">Auto mix</button></div>
          <div class="mode-grid"><button type="button" class="mode-option" *ngFor="let mode of modeOptions" [class.selected]="isModeSelected(mode.value)" (click)="toggleMode(mode.value)"><mat-icon>{{ mode.group === 'choice' ? 'check_circle' : mode.group === 'text' ? 'edit_note' : mode.group === 'matching' ? 'join_inner' : 'style' }}</mat-icon><span>{{ mode.label }}</span><mat-icon class="mode-check" *ngIf="isModeSelected(mode.value)">done</mat-icon></button></div>
          <p class="selection-summary"><mat-icon>auto_awesome</mat-icon>{{ selectedModes().length ? selectedModes().length + ' game types selected.' : 'AI will mix all game types to keep recall varied.' }}</p>
          <p class="error-text" *ngIf="setupError">{{ setupError }}</p>
          <p class="warning-text" *ngIf="generationWarning">{{ generationWarning }}</p>
          <div class="form-actions"><button mat-flat-button color="primary" type="button" (click)="generateAiPractice()" [disabled]="generating || !deckItems().length"><mat-spinner diameter="20" *ngIf="generating"></mat-spinner><span *ngIf="!generating">Generate AI practice</span></button><button mat-stroked-button type="button" (click)="startQuickPractice()" [disabled]="generating || !deckItems().length">Quick deterministic practice</button></div>
        </section>
      </ng-container>

      <ng-container *ngIf="!loading && phase === 'session'">
        <div class="practice-top"><div><p class="eyebrow">{{ source === 'gemini' ? 'AI practice session' : 'Quick practice session' }}</p><h1>{{ deckName }}</h1></div><span class="status-chip">{{ currentIndex + 1 }} / {{ questions().length }}</span></div>
        <p class="warning-text" *ngIf="generationWarning"><mat-icon>info</mat-icon>{{ generationWarning }}</p>
        <mat-progress-bar mode="determinate" [value]="progress"></mat-progress-bar>
        <section class="panel question-card" *ngIf="currentQuestion as question">
          <div class="question-meta"><span class="status-chip">{{ formatType(question.type) }}</span><span class="muted">Focus on recall, not speed.</span></div>
          <h2>{{ question.prompt }}</h2>
          <div class="choices" *ngIf="isChoiceQuestion(question) || question.type === 'matching_pairs'; else answerInput">
            <button type="button" class="choice" *ngFor="let choice of questionChoices(question)" [class.selected]="selectedAnswer === choice" [disabled]="submitted" (click)="selectedAnswer = choice">{{ choice }}</button>
          </div>
          <ng-template #answerInput><mat-form-field appearance="outline" class="full-width" *ngIf="question.type !== 'flashcard'; else flashcardPrompt"><mat-label>Your answer</mat-label><input matInput [formControl]="answerControl" (keyup.enter)="submitAnswer()" [disabled]="submitted" /></mat-form-field></ng-template>
          <ng-template #flashcardPrompt><div class="flashcard-answer" *ngIf="submitted; else revealPrompt"><strong>{{ question.answer }}</strong><span>{{ question.explanation }}</span></div><ng-template #revealPrompt><p class="muted">Say the answer out loud, then reveal it.</p></ng-template></ng-template>
          <div class="feedback" *ngIf="submitted" [class.correct]="lastCorrect" [class.incorrect]="!lastCorrect"><mat-icon>{{ lastCorrect ? 'check_circle' : 'error' }}</mat-icon><div><strong>{{ lastCorrect ? 'Correct' : 'Keep this one in your next review.' }}</strong><p>{{ question.explanation }}</p></div></div>
          <div class="question-actions"><button mat-button *ngIf="!submitted && question.type === 'flashcard'" (click)="submitAnswer(question.answer)">Reveal answer</button><button mat-flat-button color="primary" *ngIf="!submitted && question.type !== 'flashcard'" (click)="submitAnswer()" [disabled]="!selectedAnswer && !answerControl.value">Check answer</button><button mat-flat-button color="primary" *ngIf="submitted" (click)="next()">{{ currentIndex + 1 === questions().length ? 'Finish' : 'Next question' }}<mat-icon>arrow_forward</mat-icon></button></div>
        </section>
      </ng-container>

      <ng-container *ngIf="!loading && phase === 'complete'">
        <section class="panel completion"><p class="eyebrow">Session complete</p><h1>Nice work.</h1><p class="muted">You answered {{ correctCount }} of {{ questions().length }} questions correctly.</p><div class="score-ring">{{ score }}%</div><div class="form-actions centered"><button mat-flat-button color="primary" type="button" (click)="resetSetup()">Create another set</button><a mat-stroked-button [routerLink]="['/decks', deckId]">Return to deck</a></div></section>
      </ng-container>

      <section class="panel empty-state" *ngIf="!loading && !deckItems().length"><mat-icon>school</mat-icon><h2>This deck needs a few words first.</h2><p>Add vocabulary, then come back for an AI or deterministic practice session.</p><a mat-flat-button color="primary" [routerLink]="['/decks', deckId, 'add']">Add words</a></section>
    </div>
  `,
  styles: [`
    .setup-card { max-width: 960px; margin: 24px auto; padding: 32px; }
    .setup-card > mat-spinner { margin: 0 auto 16px; }
    .setup-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .mode-header { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin: 28px 0 16px; }
    .mode-header h2 { margin: 0 0 6px; }
    .mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mode-option { display: flex; align-items: center; gap: 8px; min-height: 54px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: white; color: var(--ink); text-align: left; cursor: pointer; }
    .mode-option:hover, .mode-option.selected { border-color: var(--brand); background: #edf6f8; }
    .mode-option mat-icon:first-child { color: var(--brand-strong); }
    .mode-check { margin-left: auto; color: #167447; }
    .selection-summary, .warning-text { display: flex; align-items: center; gap: 8px; margin: 18px 0; color: var(--brand-strong); }
    .warning-text { color: #704f00; }
    .form-actions { display: flex; align-items: center; gap: 10px; }
    .centered { justify-content: center; }
    .practice-top { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin: 24px 0 16px; }
    .practice-top h1 { margin: 0; font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.06em; }
    .question-card { max-width: 780px; margin: 28px auto; padding: 32px; }
    .question-meta, .question-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .question-card h2 { margin: 40px 0 28px; font-size: clamp(1.6rem, 4vw, 2.6rem); line-height: 1.15; }
    .choices { display: grid; gap: 12px; }
    .choice { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: white; color: var(--ink); text-align: left; cursor: pointer; }
    .choice:hover, .choice.selected { border-color: var(--brand); background: #edf6f8; }
    .feedback { display: flex; gap: 12px; margin: 24px 0; padding: 16px; border-radius: 12px; background: #fff8e5; color: #704f00; }
    .feedback.correct { background: #eaf7ef; color: #167447; }
    .feedback p, .flashcard-answer span { margin: 4px 0 0; color: inherit; opacity: .82; }
    .flashcard-answer { display: grid; gap: 8px; padding: 30px; border-radius: 16px; background: #edf6f8; font-size: 1.3rem; }
    .completion { max-width: 620px; margin: 80px auto; padding: 44px; text-align: center; }
    .completion h1 { margin: 0 0 10px; font-size: 3.5rem; letter-spacing: -.06em; }
    .score-ring { display: grid; place-items: center; width: 130px; height: 130px; margin: 28px auto; border: 12px solid var(--accent); border-radius: 50%; font-size: 1.8rem; font-weight: 900; }
    @media (max-width: 800px) { .setup-grid, .mode-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 650px) { .setup-card, .question-card { padding: 22px; } .mode-header, .question-meta, .question-actions { align-items: flex-start; flex-direction: column; } .mode-grid, .setup-grid { grid-template-columns: 1fr; } .question-actions button { width: 100%; } }
  `],
})
export class PracticeComponent implements OnInit {
  readonly questions = signal<PracticeQuestion[]>([]);
  readonly answerControl = new FormControl('', { nonNullable: true });
  readonly deckItems = signal<DeckItem[]>([]);
  readonly selectedModes = signal<ExerciseType[]>([]);
  readonly modeOptions = MODE_OPTIONS;
  readonly countControl = new FormControl(20, { nonNullable: true });
  readonly difficultyControl = new FormControl<ExerciseDifficulty>('adaptive', { nonNullable: true });
  readonly directionControl = new FormControl<ExerciseDirection>('source_to_target', { nonNullable: true });
  private readonly route = inject(ActivatedRoute);
  private readonly deckService = inject(DeckService);
  private readonly practiceService = inject(PracticeService);
  loading = true;
  generating = false;
  phase: 'setup' | 'session' | 'complete' = 'setup';
  currentIndex = 0;
  selectedAnswer = '';
  submitted = false;
  lastCorrect = false;
  correctCount = 0;
  sessionId: string | null = null;
  exerciseSetId: string | null = null;
  questionStartedAt = Date.now();
  deckName = 'Practice';
  source: 'gemini' | 'deterministic' = 'deterministic';
  setupError = '';
  generationWarning = '';

  get deckId(): string { return this.route.snapshot.paramMap.get('deckId') ?? ''; }
  get currentQuestion(): PracticeQuestion | null { return this.questions()[this.currentIndex] ?? null; }
  get progress(): number { return this.questions().length ? ((this.currentIndex + (this.submitted ? 1 : 0)) / this.questions().length) * 100 : 0; }
  get score(): number { return this.questions().length ? Math.round((this.correctCount / this.questions().length) * 100) : 0; }

  async ngOnInit(): Promise<void> {
    if (!this.deckId) { this.loading = false; return; }
    try {
      const deck = await this.deckService.getDeck(this.deckId);
      this.deckName = deck?.name ?? 'Practice';
      this.deckItems.set(await this.deckService.listDeckItems(this.deckId));
      const setId = this.route.snapshot.queryParamMap.get('setId');
      if (setId) {
        const set = await this.practiceService.loadSet(setId);
        await this.startGeneratedPractice(set);
      }
    } catch (error) {
      this.setupError = this.toMessage(error, 'Unable to load this practice set.');
    } finally {
      this.loading = false;
    }
  }

  async generateAiPractice(): Promise<void> {
    this.setupError = '';
    this.generationWarning = '';
    if (!this.hasUsableVocabulary()) {
      this.setupError = 'Add meanings to at least one word before starting practice.';
      return;
    }
    const count = Number(this.countControl.value);
    if (!Number.isInteger(count) || count < 10 || count > 100) {
      this.setupError = 'Choose between 10 and 100 questions.';
      return;
    }
    this.generating = true;
    try {
      const response = await this.practiceService.generateSet({
        deckId: this.deckId,
        count,
        modes: this.selectedModes(),
        difficulty: this.difficultyControl.value,
        direction: this.directionControl.value,
        title: `${this.deckName} practice`,
      });
      await this.startGeneratedPractice(response);
    } catch (error) {
      this.setupError = this.toMessage(error, 'AI practice could not be generated.');
    } finally {
      this.generating = false;
    }
  }

  async startQuickPractice(): Promise<void> {
    this.setupError = '';
    this.generationWarning = '';
    if (!this.hasUsableVocabulary()) {
      this.setupError = 'Add meanings to at least one word before starting practice.';
      return;
    }
    const limit = Math.min(20, this.deckItems().length);
    if (!limit) {
      this.setupError = 'Add vocabulary before starting practice.';
      return;
    }
    const questions = this.practiceService.buildQuestions(this.deckItems(), limit);
    if (!questions.length) {
      this.setupError = 'Add meanings to at least one word before starting practice.';
      return;
    }
    await this.startSession(questions, null, 'deterministic');
  }

  private hasUsableVocabulary(): boolean {
    return this.deckItems().some((item) => this.practiceService.hasMeaning(item));
  }

  toggleMode(mode: ExerciseType): void {
    this.selectedModes.update((modes) => modes.includes(mode) ? modes.filter((value) => value !== mode) : [...modes, mode]);
  }

  isModeSelected(mode: ExerciseType): boolean { return this.selectedModes().includes(mode); }
  clearModes(): void { this.selectedModes.set([]); }

  async submitAnswer(value?: string): Promise<void> {
    const question = this.currentQuestion;
    if (!question || this.submitted) return;
    const answer = value ?? (this.selectedAnswer || this.answerControl.value);
    this.lastCorrect = this.practiceService.isCorrect(question, answer);
    if (this.lastCorrect) this.correctCount += 1;
    this.submitted = true;
    try {
      await this.practiceService.recordAttempt(this.sessionId, question, answer, this.lastCorrect, Date.now() - this.questionStartedAt);
    } catch (error) {
      console.warn('Progress could not be saved', error);
    }
  }

  next(): void {
    if (this.currentIndex + 1 === this.questions().length) {
      void this.practiceService.completeSession(this.sessionId, this.correctCount, this.questions().length).catch((error: unknown) => console.warn('Session completion could not be saved', error));
      this.phase = 'complete';
      return;
    }
    this.currentIndex += 1;
    this.selectedAnswer = '';
    this.answerControl.reset('');
    this.submitted = false;
    this.questionStartedAt = Date.now();
  }

  resetSetup(): void {
    this.phase = 'setup';
    this.questions.set([]);
    this.currentIndex = 0;
    this.correctCount = 0;
    this.sessionId = null;
    this.exerciseSetId = null;
    this.submitted = false;
    this.selectedAnswer = '';
    this.generationWarning = '';
  }

  isChoiceQuestion(question: PracticeQuestion): boolean {
    return ['multiple_choice_meaning', 'multiple_choice_term', 'true_false', 'context_choice', 'odd_one_out', 'example_choice', 'multiple_choice'].includes(question.type);
  }

  questionChoices(question: PracticeQuestion): string[] {
    if (question.choices.length) return question.choices;
    return this.matchingPairs(question).map((pair) => pair.right);
  }

  matchingPairs(question: PracticeQuestion): MatchingPair[] {
    const pairs = question.payload?.['pairs'];
    return Array.isArray(pairs) ? pairs.filter((pair): pair is MatchingPair => Boolean(pair && typeof pair === 'object' && typeof (pair as MatchingPair).left === 'string' && typeof (pair as MatchingPair).right === 'string')) : [];
  }

  formatType(type: ExerciseType): string { return this.modeOptions.find((option) => option.value === type)?.label ?? type.replaceAll('_', ' '); }

  private async startGeneratedPractice(response: ExerciseGenerationResponse): Promise<void> {
    this.generationWarning = response.warning ?? '';
    await this.startSession(response.questions, response.exerciseSetId, response.source);
  }

  private async startSession(questions: PracticeQuestion[], exerciseSetId: string | null, source: 'gemini' | 'deterministic'): Promise<void> {
    this.questions.set(questions);
    this.exerciseSetId = exerciseSetId;
    this.source = source;
    this.currentIndex = 0;
    this.correctCount = 0;
    this.selectedAnswer = '';
    this.answerControl.reset('');
    this.submitted = false;
    this.questionStartedAt = Date.now();
    this.sessionId = questions.length ? await this.practiceService.createSession(this.deckId, questions.length, exerciseSetId ?? undefined) : null;
    this.phase = questions.length ? 'session' : 'setup';
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
