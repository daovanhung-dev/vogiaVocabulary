export interface LexiconSearchRequest {
  query: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface ProviderSense {
  partOfSpeech: string | null;
  definition: string;
  definitionLanguageCode: string;
  orderIndex: number;
  source: string;
  translations: Array<{
    translation: string;
    targetLanguageCode: string;
    source: string;
    confidence: number;
  }>;
  examples: Array<{
    sentence: string;
    sentenceTranslation: string | null;
    languageCode: string;
    source: string;
  }>;
}

export interface LexiconSearchResult {
  term: string;
  normalizedTerm: string;
  languageCode: string;
  romanization: string | null;
  phonetic: string | null;
  audioUrl: string | null;
  source: string;
  sourceReference: string | null;
  sourcePayload?: Record<string, unknown>;
  senses: ProviderSense[];
}

export interface LexiconProvider {
  search(request: LexiconSearchRequest): Promise<LexiconSearchResult[]>;
  getDetails(
    request: LexiconSearchRequest & { term: string },
  ): Promise<LexiconSearchResult>;
}
