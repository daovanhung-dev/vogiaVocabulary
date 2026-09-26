import { describe, expect, it } from 'vitest';
import { PracticeService } from '../src/app/features/practice/practice.service';
import { DeckItem } from '../src/app/shared/models/domain.models';

describe('PracticeService', () => {
  const service = new PracticeService({} as never);
  const missingMeaning = { id: 'missing', lexeme: { term: 'apple', senses: [] } } as DeckItem;
  const definedMeaning = {
    id: 'defined',
    lexeme: { term: 'apple', senses: [{ definition: 'a fruit', translations: [] }] },
  } as DeckItem;

  it('does not treat a word without a meaning as practice-ready', () => {
    expect(service.hasMeaning(missingMeaning)).toBe(false);
    expect(service.buildQuestions([missingMeaning])).toEqual([]);
  });

  it('builds deterministic questions from a word with a meaning', () => {
    expect(service.hasMeaning(definedMeaning)).toBe(true);
    expect(service.buildQuestions([definedMeaning])).toHaveLength(1);
  });
});
