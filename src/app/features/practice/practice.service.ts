import { Injectable } from '@angular/core';
import {
  DeckItem,
  ExerciseGenerationRequest,
  ExerciseGenerationResponse,
  ExerciseType,
  PracticeQuestion,
  ReviewResponse,
} from '../../shared/models/domain.models';
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
      const type: ExerciseType = (['multiple_choice_meaning', 'typing_meaning', 'flashcard', 'matching_pairs'] as ExerciseType[])[index % 4];
      const answer = this.meaning(item);
      const distractors = meanings.filter((meaning) => meaning !== answer).slice(0, 3);
      const choices = type === 'matching_pairs' ? [] : this.shuffle([answer, ...distractors]);
      const prompt = type === 'typing_meaning'
        ? `Type the meaning of “${item.lexeme?.term}”.`
        : type === 'flashcard'
          ? `Recall the meaning of “${item.lexeme?.term}”.`
          : type === 'matching_pairs'
            ? `Match “${item.lexeme?.term}” with its meaning.`
            : `What does “${item.lexeme?.term}” mean?`;
      return {
        id: `local-${item.id}-${index}`,
        type,
        deckItemId: item.id,
        term: item.lexeme?.term ?? '',
        prompt,
        answer,
        choices,
        explanation: `${item.lexeme?.term} means ${answer}.`,
        acceptedAnswers: [answer],
        payload: type === 'matching_pairs' ? { pairs: [{ left: item.lexeme?.term ?? '', right: answer }] } : {},
        source: 'deterministic',
      };
    });
  }

  isCorrect(question: PracticeQuestion, answer: string): boolean {
    const normalizedAnswer = normalizeTerm(answer);
    return [question.answer, ...(question.acceptedAnswers ?? [])]
      .some((expected) => normalizeTerm(expected) === normalizedAnswer);
  }

  async generateSet(request: ExerciseGenerationRequest): Promise<ExerciseGenerationResponse> {
    if (!this.supabase.configured) throw new Error('Supabase is not configured.');
    const { data, error } = await this.supabase.requiredClient.functions.invoke<ExerciseGenerationResponse>('learning-api', {
      body: { route: 'generate-set', ...request },
    });
    if (error) throw error;
    if (!data?.exerciseSetId) throw new Error('The practice set could not be created.');
    return data;
  }

  async loadSet(exerciseSetId: string): Promise<ExerciseGenerationResponse> {
    if (!this.supabase.configured) throw new Error('Supabase is not configured.');
    const { data, error } = await this.supabase.requiredClient.functions.invoke<ExerciseGenerationResponse>('learning-api', {
      body: { route: 'get-set', exerciseSetId },
    });
    if (error) throw error;
    if (!data?.exerciseSetId) throw new Error('The practice set could not be loaded.');
    return data;
  }

  async createSession(deckId: string, questionCount: number, exerciseSetId?: string): Promise<string | null> {
    if (!this.supabase.configured) return null;
    const { data, error } = await this.supabase.requiredClient.functions.invoke<{ sessionId: string }>('learning-api', {
      body: { route: 'sessions', deckId, questionCount, ...(exerciseSetId ? { exerciseSetId } : {}) },
    });
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
