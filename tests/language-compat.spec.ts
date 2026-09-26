import { describe, expect, it } from 'vitest';
import { hasImportableDefinition, languageMismatchMessage } from '../src/app/shared/utils/language-compat';

describe('language compatibility', () => {
  it('rejects Japanese text for an English deck', () => {
    expect(languageMismatchMessage('こんにちは', 'en', 'vi')).toContain('Japanese');
    expect(languageMismatchMessage('こんにちは', 'en', 'vi')).toContain('Japanese → Vietnamese');
  });

  it('accepts Japanese text for a Japanese deck', () => {
    expect(languageMismatchMessage('こんにちは', 'ja', 'vi')).toBeNull();
  });

  it('only allows candidates with a non-empty definition', () => {
    expect(hasImportableDefinition({ senses: [] })).toBe(false);
    expect(hasImportableDefinition({ senses: [{ definition: '  ' }] })).toBe(false);
    expect(hasImportableDefinition({ senses: [{ definition: 'greeting' }] })).toBe(true);
  });
});
