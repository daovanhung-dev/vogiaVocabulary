const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  vi: 'Vietnamese',
  ja: 'Japanese',
  ko: 'Korean',
};

function normalizeLanguageCode(value: string): string {
  return value.trim().toLowerCase().split('-')[0];
}

export function detectLikelyLanguage(value: string): string | null {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) return 'ja';
  if (/\p{Script=Hangul}/u.test(value)) return 'ko';
  return null;
}

export function languageMismatchMessage(term: string, sourceLanguage: string, targetLanguage: string): string | null {
  const detected = detectLikelyLanguage(term);
  const source = normalizeLanguageCode(sourceLanguage);
  if (!detected || detected === source) return null;
  const detectedName = LANGUAGE_NAMES[detected] ?? detected;
  const sourceName = LANGUAGE_NAMES[source] ?? source;
  const target = LANGUAGE_NAMES[normalizeLanguageCode(targetLanguage)] ?? normalizeLanguageCode(targetLanguage);
  return `This word appears to be ${detectedName}, but this deck searches ${sourceName}. Choose a ${detectedName} → ${target} deck.`;
}

export function hasImportableDefinition(result: { senses?: Array<{ definition?: string | null }> }): boolean {
  return result.senses?.some((sense) => Boolean(sense.definition?.trim())) ?? false;
}
