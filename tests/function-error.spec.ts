import { describe, expect, it } from 'vitest';
import { toLexiconError } from '../src/app/features/search/function-error';

describe('toLexiconError', () => {
  it('explains when the Edge Function is missing', async () => {
    const error = await toLexiconError({ message: 'Edge Function returned a non-2xx status code', context: { status: 404 } });
    expect(error.message).toContain('lexicon-api');
    expect(error.message).toContain('chưa được deploy');
  });

  it('keeps authentication errors distinct', async () => {
    expect((await toLexiconError({ message: 'AUTH_REQUIRED', context: { status: 401 } })).message).toContain('anonymous session');
  });

  it('reports network failures separately', async () => {
    expect((await toLexiconError(new Error('Failed to send a request to the Edge Function'))).message).toContain('kết nối');
  });

  it('uses the structured language mismatch response', async () => {
    const response = new Response(JSON.stringify({ error: { code: 'LANGUAGE_MISMATCH', message: 'Choose a Japanese deck.' } }), { status: 422 });
    const error = await toLexiconError({ message: 'Edge Function returned a non-2xx status code', context: response });
    expect(error.message).toBe('Choose a Japanese deck.');
  });

  it('uses the structured details-unavailable response', async () => {
    const response = new Response(JSON.stringify({ error: { code: 'DETAILS_UNAVAILABLE', message: 'No definition found.' } }), { status: 422 });
    const error = await toLexiconError({ message: 'Edge Function returned a non-2xx status code', context: response });
    expect(error.message).toBe('No definition found.');
  });

  it('does not expose the generic non-2xx message for provider failures', async () => {
    const response = new Response(JSON.stringify({ error: { code: 'LEXICON_PROVIDER_TIMEOUT', message: 'LEXICON_PROVIDER_503' } }), { status: 502 });
    const error = await toLexiconError({ message: 'Edge Function returned a non-2xx status code', context: response });
    expect(error.message).toContain('dictionary provider');
    expect(error.message).not.toContain('non-2xx');
  });
});
