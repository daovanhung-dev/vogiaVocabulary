import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DeckItem, PracticeQuestion } from '../../shared/models/domain.models';
import { DeckService } from '../decks/deck.service';
import { PracticeService } from './practice.service';
import { normalizeTerm } from '../../shared/utils/normalize';

@Component({
  selector: 'gv-practice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatInputModule, MatProgressBarModule],
  template: `
    <div class="page">
      <a mat-button [routerLink]="['/decks', deckId]"><mat-icon>arrow_back</mat-icon>Back to deck</a>
      <ng-container *ngIf="finished; else practiceView">
        <section class="panel completion"><p class="eyebrow">Session complete</p><h1>Nice work.</h1><p class="muted">You answered {{ correctCount }} of {{ questions().length }} questions correctly.</p><div class="score-ring">{{ score }}%</div><a mat-flat-button color="primary" [routerLink]="['/decks', deckId]">Return to deck</a></section>
      </ng-container>
      <ng-template #practiceView>
        <ng-container *ngIf="currentQuestion as question; else noQuestions">
          <div class="practice-top"><div><p class="eyebrow">Practice session</p><h1>{{ deckName }}</h1></div><span class="status-chip">{{ currentIndex + 1 }} / {{ questions().length }}</span></div>
          <mat-progress-bar mode="determinate" [value]="progress"></mat-progress-bar>
          <section class="panel question-card"><div class="question-meta"><span class="status-chip">{{ question.type.replace('_', ' ') }}</span><span class="muted">Focus on recall, not speed.</span></div><h2>{{ question.prompt }}</h2>
            <div class="choices" *ngIf="question.type === 'multiple_choice' || question.type === 'matching'; else answerInput"><button type="button" class="choice" *ngFor="let choice of question.choices" [class.selected]="selectedAnswer === choice" [disabled]="submitted" (click)="selectedAnswer = choice">{{ choice }}</button></div>
            <ng-template #answerInput><mat-form-field appearance="outline" class="full-width" *ngIf="question.type !== 'flashcard'; else flashcardPrompt"><mat-label>Your answer</mat-label><input matInput [formControl]="answerControl" (keyup.enter)="submitAnswer()" [disabled]="submitted" /></mat-form-field></ng-template>
            <ng-template #flashcardPrompt><div class="flashcard-answer" *ngIf="submitted; else revealPrompt"><strong>{{ question.answer }}</strong><span>{{ question.explanation }}</span></div><ng-template #revealPrompt><p class="muted">Say the answer out loud, then reveal it.</p></ng-template></ng-template>
            <div class="feedback" *ngIf="submitted" [class.correct]="lastCorrect" [class.incorrect]="!lastCorrect"><mat-icon>{{ lastCorrect ? 'check_circle' : 'error' }}</mat-icon><div><strong>{{ lastCorrect ? 'Correct' : 'Keep this one in your next review.' }}</strong><p>{{ question.explanation }}</p></div></div>
            <div class="question-actions"><button mat-button *ngIf="!submitted && question.type === 'flashcard'" (click)="submitAnswer(question.answer)">Reveal answer</button><button mat-flat-button color="primary" *ngIf="!submitted && question.type !== 'flashcard'" (click)="submitAnswer()" [disabled]="!selectedAnswer && !answerControl.value">Check answer</button><button mat-flat-button color="primary" *ngIf="submitted" (click)="next()">{{ currentIndex + 1 === questions().length ? 'Finish' : 'Next question' }}<mat-icon>arrow_forward</mat-icon></button></div>
          </section>
        </ng-container>
      </ng-template>
      <ng-template #noQuestions><section class="panel empty-state"><mat-icon>school</mat-icon><h2>This deck needs a few words first.</h2><p>Add vocabulary, then come back for a deterministic practice session.</p><a mat-flat-button color="primary" [routerLink]="['/decks', deckId, 'add']">Add words</a></section></ng-template>
    </div>
  `,
  styles: [`
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
    @media (max-width: 650px) { .question-card { padding: 22px; } .question-meta, .question-actions { align-items: flex-start; flex-direction: column; } .question-actions button { width: 100%; } }
  `],
})
export class PracticeComponent implements OnInit {
  readonly questions = signal<PracticeQuestion[]>([]);
  readonly answerControl = new FormControl('', { nonNullable: true });
  readonly deckItems = signal<DeckItem[]>([]);
  private readonly route = inject(ActivatedRoute);
  private readonly deckService = inject(DeckService);
  private readonly practiceService = inject(PracticeService);
  currentIndex = 0;
  selectedAnswer = '';
  submitted = false;
  lastCorrect = false;
  correctCount = 0;
  sessionId: string | null = null;
  questionStartedAt = Date.now();
  deckName = 'Practice';

  get deckId(): string { return this.route.snapshot.paramMap.get('deckId') ?? ''; }
  get currentQuestion(): PracticeQuestion | null { return this.questions()[this.currentIndex] ?? null; }
  get progress(): number { return this.questions().length ? ((this.currentIndex + (this.submitted ? 1 : 0)) / this.questions().length) * 100 : 0; }
  get finished(): boolean { return this.questions().length > 0 && this.currentIndex >= this.questions().length; }
  get score(): number { return this.questions().length ? Math.round((this.correctCount / this.questions().length) * 100) : 0; }

  async ngOnInit(): Promise<void> {
    if (!this.deckId) return;
    const deck = await this.deckService.getDeck(this.deckId);
    this.deckName = deck?.name ?? 'Practice';
    const items = await this.deckService.listDeckItems(this.deckId);
    this.deckItems.set(items);
    this.questions.set(this.practiceService.buildQuestions(items));
    if (this.questions().length) this.sessionId = await this.practiceService.createSession(this.deckId, this.questions().length);
  }

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
    }
    this.currentIndex += 1;
    this.selectedAnswer = '';
    this.answerControl.reset('');
    this.submitted = false;
    this.questionStartedAt = Date.now();
  }

  protected readonly normalizeTerm = normalizeTerm;
}
