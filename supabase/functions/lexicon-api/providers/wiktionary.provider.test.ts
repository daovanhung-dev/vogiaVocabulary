import { WiktionaryProvider } from './wiktionary.provider.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('parses current Wiktionary definitions and cleans markup', async () => {
  const provider = new WiktionaryProvider(async () => new Response(JSON.stringify({
    en: [{
      partOfSpeech: 'Noun',
      definitions: [{
        definition: 'A <b>small</b> fruit &amp; snack.',
        parsedExamples: [{ example: 'Eat an <b>apple</b>.' }],
      }, { definition: '' }],
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const result = await provider.getDetails({ query: 'apple', term: 'apple', sourceLanguage: 'en', targetLanguage: 'vi' });
  assert(result.senses.length === 1, 'Expected one non-empty sense');
  assert(result.senses[0].definition === 'A small fruit & snack.', 'Expected cleaned definition');
  assert(result.senses[0].examples[0].sentence === 'Eat an apple.', 'Expected cleaned example');
});

Deno.test('keeps compatibility with the legacy senses/glosses schema', async () => {
  const provider = new WiktionaryProvider(async () => new Response(JSON.stringify({
    en: [{
      partOfSpeech: 'Verb',
      senses: [{ glosses: ['to <i>run</i>'], examples: [{ text: 'They run.' }] }],
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const result = await provider.getDetails({ query: 'run', term: 'run', sourceLanguage: 'en', targetLanguage: 'vi' });
  assert(result.senses.length === 1, 'Expected legacy sense');
  assert(result.senses[0].definition === 'to run', 'Expected legacy definition');
});
