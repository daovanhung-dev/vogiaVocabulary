import { describe, expect, it } from 'vitest';
import { DeckItem, LexiconSearchResult } from '../src/app/shared/models/domain.models';
import { firstDictionaryMeaning, fromDeckItem, fromLexiconResult } from '../src/app/shared/utils/dictionary';

describe('dictionary view mapping', () => {
  it('keeps pronunciation, audio, senses, translations and examples from search', () => {
    const result: LexiconSearchResult = {
      term: 'hello',
      normalizedTerm: 'hello',
      languageCode: 'en',
      romanization: null,
      phonetic: '/həˈloʊ/',
      audioUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/hello.ogg',
      source: 'wiktionary',
      sourceReference: 'https://en.wiktionary.org/wiki/hello',
      senses: [{
        partOfSpeech: 'Interjection',
        definition: 'A greeting.',
        definitionLanguageCode: 'en',
        orderIndex: 0,
        source: 'wiktionary',
        translations: [{ translation: 'xin chào', targetLanguageCode: 'vi', source: 'wiktionary', confidence: 0.85 }],
        examples: [{ sentence: 'Hello, everyone.', sentenceTranslation: null, languageCode: 'en', source: 'wiktionary' }],
      }],
    };

    const entry = fromLexiconResult(result);
    expect(entry.phonetic).toBe('/həˈloʊ/');
    expect(entry.audioUrl).toContain('hello.ogg');
    expect(entry.senses[0].partOfSpeech).toBe('Interjection');
    expect(entry.senses[0].translations[0].value).toBe('xin chào');
    expect(entry.senses[0].examples[0].sentence).toBe('Hello, everyone.');
  });

  it('maps saved snake_case vocabulary metadata back to dictionary details', () => {
    const item = {
      id: 'item-1',
      deck_id: 'deck-1',
      lexeme_id: 'lexeme-1',
      preferred_translation_id: null,
      custom_meaning: null,
      custom_note: null,
      priority: 0,
      created_at: '2026-09-26T00:00:00.000Z',
      lexeme: {
        id: 'lexeme-1',
        language_id: 'en',
        term: 'apple',
        normalized_term: 'apple',
        romanization: null,
        phonetic: '/ˈæpəl/',
        audio_url: 'https://commons.wikimedia.org/wiki/Special:FilePath/apple.ogg',
        source: 'wiktionary',
        source_reference: 'https://en.wiktionary.org/wiki/apple',
        senses: [{
          part_of_speech: 'noun',
          definition: 'A fruit.',
          translations: [{ translation: 'quả táo', romanization: null }],
          examples: [{ sentence: 'I ate an apple.', sentence_translation: null, language_id: 'en' }],
        }],
      },
    } as DeckItem;

    const entry = fromDeckItem(item);
    expect(entry.phonetic).toBe('/ˈæpəl/');
    expect(entry.senses[0].translations[0].value).toBe('quả táo');
    expect(firstDictionaryMeaning(entry)).toBe('quả táo');
  });
});
