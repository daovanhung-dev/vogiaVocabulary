import { describe, expect, it } from 'vitest';
import { normalizeTerm, parseBatchInput } from '../src/app/shared/utils/normalize';

describe('normalizeTerm', () => {
  it('trims, normalizes unicode and collapses spaces', () => {
    expect(normalizeTerm('  Ａpple   pie  ')).toBe('apple pie');
  });

  it('preserves scripts while normalizing whitespace', () => {
    expect(normalizeTerm('  食べる  ')).toBe('食べる');
  });
});

describe('parseBatchInput', () => {
  it('accepts lines and commas and removes duplicates', () => {
    expect(parseBatchInput('apple\nbanana, apple;orange')).toEqual(['apple', 'banana', 'orange']);
  });
});
