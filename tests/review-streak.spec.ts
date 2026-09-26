import { describe, expect, it } from 'vitest';
import { calculateReviewStreakDays } from '../src/app/shared/utils/review-streak';

describe('calculateReviewStreakDays', () => {
  const now = new Date('2026-09-26T10:00:00.000Z');

  it('counts unique consecutive review dates ending today', () => {
    expect(calculateReviewStreakDays([
      '2026-09-26T02:00:00.000Z',
      '2026-09-26T03:00:00.000Z',
      '2026-09-25T03:00:00.000Z',
      '2026-09-24T03:00:00.000Z',
    ], now, 'UTC')).toBe(3);
  });

  it('continues a streak from yesterday but expires an older streak', () => {
    expect(calculateReviewStreakDays(['2026-09-25T03:00:00.000Z'], now, 'UTC')).toBe(1);
    expect(calculateReviewStreakDays(['2026-09-23T03:00:00.000Z'], now, 'UTC')).toBe(0);
  });

  it('uses the requested timezone when grouping calendar dates', () => {
    expect(calculateReviewStreakDays([
      '2026-09-25T23:30:00.000Z',
      '2026-09-24T23:30:00.000Z',
    ], new Date('2026-09-26T00:30:00.000Z'), 'Asia/Ho_Chi_Minh')).toBe(2);
  });
});
