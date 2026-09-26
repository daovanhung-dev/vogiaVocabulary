import { Injectable } from '@angular/core';
import { DeckItem, ExerciseType, PracticeQuestion, ReviewResponse } from '../../shared/models/domain.models';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { normalizeTerm } from '../../shared/utils/normalize';

@Injectable({ providedIn: 'root' })
export class PracticeService {
  constructor(private readonly supabase: SupabaseService) {}

  buildQuestions(items: DeckItem[], limit = 20): PracticeQuestion[] {
    const usable = items.filter((item) => item.lexeme?.term && this.meaning(item));
    const pool = [...usable].sort((a, b) => (a.review_state?.mastery ?? 0) - (b.review_state?.mastery ?? 0)).slice(0, limit);
    const meanings = usable.map((item) => this.meaning(item));
    return pool.map((item, index) => {
      const type: ExerciseType = (['multiple_choice', 'typing', 'flashcard', 'matching'] as ExerciseType[])[index % 4];
      const answer = this.meaning(item);
      const distractors = meanings.filter((meaning) => meaning !== answer).slice(0, 3);
      const choices = this.shuffle([answer, ...distractors]);
      const prompt = type === 'typing' ? `Type the meaning of “${item.lexeme?.term}”.` : type === 'flashcard' ? `Recall the meaning of “${item.lexeme?.term}”.` : type === 'matching' ? `Match “${item.lexeme?.term}” with its meaning.` : `What does “${item.lexeme?.term}” mean?`;
      return { id: `local-${item.id}-${index}`, type, deckItemId: item.id, term: item.lexeme?.term ?? '', prompt, answer, choices, explanation: `${item.lexeme?.term} means ${answer}.` };
    });
  }

  isCorrect(question: PracticeQuestion, answer: string): boolean {
    return normalizeTerm(answer) === normalizeTerm(question.answer);
  }

  async createSession(deckId: string, questionCount: number): Promise<string | null> {
    if (!this.supabase.configured) return null;
    const { data, error } = await this.supabase.requiredClient.functions.invoke<{ sessionId: string }>('learning-api', { body: { route: 'sessions', deckId, questionCount } });
    if (error) throw error;
    return data?.sessionId ?? null;
  }

  async recordAttempt(sessionId: string | null, question: PracticeQuestion, answer: string, isCorrect: boolean, responseTimeMs: number): Promise<ReviewResponse | null> {
    if (!this.supabase.configured) return null;
    const { data, error } = await this.supabase.requiredClient.functions.invoke<ReviewResponse>('learning-api', {
      body: { route: 'attempts', sessionId, deckItemId: question.deckItemId, questionId: question.id, submittedAnswer: answer, isCorrect, responseTimeMs },
    });
    if (error) throw error;
    return data;
  }

  async completeSession(sessionId: string | null, correctCount: number, totalQuestions: number): Promise<void> {
    if (!this.supabase.configured || !sessionId) return;
    const { error } = await this.supabase.requiredClient.functions.invoke('learning-api', { body: { route: 'complete', sessionId, correctCount, totalQuestions } });
    if (error) throw error;
  }

  private meaning(item: DeckItem): string { return item.custom_meaning || item.lexeme?.senses?.[0]?.translations?.[0]?.translation || item.lexeme?.senses?.[0]?.definition || ''; }

  private shuffle<T>(values: T[]): T[] {
    return [...values].sort(() => Math.random() - 0.5);
  }
}
