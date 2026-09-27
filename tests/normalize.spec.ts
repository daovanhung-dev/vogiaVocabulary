import { describe, expect, it } from 'vitest';
import { normalizeTerm, parseBatchInput, uniqueByNormalizedTerm } from '../src/app/shared/utils/normalize';

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

describe('uniqueByNormalizedTerm', () => {
  it('keeps the first candidate when batch searches return the same word more than once', () => {
    const first = { term: 'Apple', normalizedTerm: ' apple ' };
    const duplicate = { term: 'ＡＰＰＬＥ', normalizedTerm: 'APPLE' };
    const other = { term: 'Banana', normalizedTerm: 'banana' };

    expect(uniqueByNormalizedTerm([first, duplicate, other])).toEqual([first, other]);
  });

  it('falls back to the term when a provider omits the normalized term', () => {
    const first = { term: '  食べる  ' };
    const duplicate = { term: '食べる', normalizedTerm: null };

    expect(uniqueByNormalizedTerm([first, duplicate])).toEqual([first]);
  });
});
