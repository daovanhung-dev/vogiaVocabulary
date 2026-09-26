import { describe, expect, it } from 'vitest';
import {
  buildDeterministicQuestions,
  GeminiExerciseProvider,
  validateGeneratedQuestions,
  validateQuestionCount,
  VocabularyContext,
} from '../supabase/functions/learning-api/exercises';

const vocabulary: VocabularyContext[] = [
  { id: 'item-1', term: 'apple', meanings: ['quả táo'], translations: [], examples: ['I ate an apple.'] },
  { id: 'item-2', term: 'book', meanings: ['quyển sách'], translations: [], examples: ['This book is useful.'] },
];

function withDenoEnvironment(values: Record<string, string | undefined>, action: () => Promise<void>): Promise<void> {
  const runtime = globalThis as unknown as { Deno?: { env: { get: (name: string) => string | undefined } } };
  const previous = runtime.Deno;
  runtime.Deno = { env: { get: (name: string) => values[name] } };
  return action().finally(() => {
    if (previous) runtime.Deno = previous;
    else delete runtime.Deno;
  });
}

describe('exercise generation validation', () => {
  it('accepts only 10 to 100 questions', () => {
    expect(() => validateQuestionCount(9)).toThrow('INVALID_QUESTION_COUNT');
    expect(validateQuestionCount(10)).toBe(10);
    expect(validateQuestionCount(100)).toBe(100);
    expect(() => validateQuestionCount(101)).toThrow('INVALID_QUESTION_COUNT');
  });

  it('rejects unknown vocabulary references and invalid choices', () => {
    expect(() => validateGeneratedQuestions({ questions: [{
      deckItemId: 'other-item',
      type: 'multiple_choice_meaning',
      prompt: 'Choose',
      choices: ['one', 'two'],
      answer: 'one',
      acceptedAnswers: ['one'],
      explanation: 'Explanation',
      difficulty: 3,
      payload: {},
    }] }, vocabulary, { count: 1, modes: [], difficulty: 'adaptive', direction: 'source_to_target' })).toThrow('AI_INVALID_QUESTION_REFERENCE');
  });

  it('builds a deterministic fallback with the requested size', () => {
    const questions = buildDeterministicQuestions(vocabulary, 10, []);
    expect(questions).toHaveLength(10);
    expect(questions.every((question) => question.deckItemId)).toBe(true);
    expect(questions.some((question) => question.type === 'flashcard')).toBe(true);
  });
});

describe('GeminiExerciseProvider', () => {
  it('parses structured JSON returned by Gemini', async () => {
    const response = { questions: [] };
    const fetchImpl = (async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }],
    }), { status: 200 })) as typeof fetch;

    await withDenoEnvironment({ GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-2.5-flash' }, async () => {
      await expect(new GeminiExerciseProvider(fetchImpl).generate(vocabulary, {
        count: 10,
        modes: [],
        difficulty: 'adaptive',
        direction: 'source_to_target',
      })).resolves.toEqual(response);
    });
  });

  it('reports quota errors without exposing the key', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 429 })) as typeof fetch;
    await withDenoEnvironment({ GEMINI_API_KEY: 'test-key' }, async () => {
      await expect(new GeminiExerciseProvider(fetchImpl).generate(vocabulary, {
        count: 10,
        modes: [],
        difficulty: 'adaptive',
        direction: 'source_to_target',
      })).rejects.toThrow('GEMINI_RATE_LIMITED');
    });
  });

  it('converts an aborted request into a timeout error', async () => {
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => await new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
    await withDenoEnvironment({ GEMINI_API_KEY: 'test-key' }, async () => {
      await expect(new GeminiExerciseProvider(fetchImpl, 5).generate(vocabulary, {
        count: 10,
        modes: [],
        difficulty: 'adaptive',
        direction: 'source_to_target',
      })).rejects.toThrow('GEMINI_TIMEOUT');
    });
  });
});
