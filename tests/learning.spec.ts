import { describe, expect, it } from 'vitest';
import { calculateLearningUpdate } from '../src/app/shared/utils/learning';

describe('calculateLearningUpdate', () => {
  it('gives fast correct answers a larger gain and schedules forward', () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const result = calculateLearningUpdate({ mastery: 0.2, stability: 1, streak: 0, correct: true, responseTimeMs: 1200 }, now);
    expect(result.mastery).toBeCloseTo(0.28);
    expect(result.streak).toBe(1);
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('reduces mastery and schedules a short retry after a wrong answer', () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const result = calculateLearningUpdate({ mastery: 0.5, stability: 4, streak: 3, correct: false, responseTimeMs: 8000 }, now);
    expect(result.mastery).toBeCloseTo(0.4);
    expect(result.streak).toBe(0);
    expect(result.nextReviewAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });
});
