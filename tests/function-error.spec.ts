import { describe, expect, it } from 'vitest';
import { toLexiconError } from '../src/app/features/search/function-error';

describe('toLexiconError', () => {
  it('explains when the Edge Function is missing', () => {
    const error = toLexiconError({ message: 'Edge Function returned a non-2xx status code', context: { status: 404 } });
    expect(error.message).toContain('lexicon-api');
    expect(error.message).toContain('chưa được deploy');
  });

  it('keeps authentication errors distinct', () => {
    expect(toLexiconError({ message: 'AUTH_REQUIRED', context: { status: 401 } }).message).toContain('anonymous session');
  });

  it('reports network failures separately', () => {
    expect(toLexiconError(new Error('Failed to send a request to the Edge Function')).message).toContain('kết nối');
  });
});
