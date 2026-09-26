import {
  DeckItem,
  LexiconSearchResult,
} from '../models/domain.models';

export interface DictionaryViewTranslation {
  value: string;
  romanization: string | null;
}

export interface DictionaryViewExample {
  sentence: string;
  translation: string | null;
}

export interface DictionaryViewSense {
  partOfSpeech: string | null;
  definition: string;
  translations: DictionaryViewTranslation[];
  examples: DictionaryViewExample[];
}

export interface DictionaryViewEntry {
  term: string;
  romanization: string | null;
  phonetic: string | null;
  audioUrl: string | null;
  sourceReference: string | null;
  customMeaning?: string | null;
  senses: DictionaryViewSense[];
}

export function fromLexiconResult(result: LexiconSearchResult): DictionaryViewEntry {
  return {
    term: result.term,
    romanization: result.romanization,
    phonetic: result.phonetic,
    audioUrl: result.audioUrl,
    sourceReference: result.sourceReference,
    senses: result.senses.map((sense) => ({
      partOfSpeech: sense.partOfSpeech,
      definition: sense.definition,
      translations: sense.translations.map((translation) => ({
        value: translation.translation,
        romanization: null,
      })),
      examples: sense.examples.map((example) => ({
        sentence: example.sentence,
        translation: example.sentenceTranslation,
      })),
    })),
  };
}

export function fromDeckItem(item: DeckItem): DictionaryViewEntry {
  return {
    term: item.lexeme?.term ?? '',
    romanization: item.lexeme?.romanization ?? null,
    phonetic: item.lexeme?.phonetic ?? null,
    audioUrl: item.lexeme?.audio_url ?? null,
    sourceReference: item.lexeme?.source_reference ?? null,
    customMeaning: item.custom_meaning,
    senses: (item.lexeme?.senses ?? []).map((sense) => ({
      partOfSpeech: sense.part_of_speech,
      definition: sense.definition,
      translations: (sense.translations ?? []).map((translation) => ({
        value: translation.translation,
        romanization: translation.romanization ?? null,
      })),
      examples: (sense.examples ?? []).map((example) => ({
        sentence: example.sentence,
        translation: example.sentence_translation,
      })),
    })),
  };
}

export function firstDictionaryMeaning(entry: DictionaryViewEntry): string {
  return entry.customMeaning ||
    entry.senses[0]?.translations[0]?.value ||
    entry.senses[0]?.definition ||
    'No meaning available';
}
