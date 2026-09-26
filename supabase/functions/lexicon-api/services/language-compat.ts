export class LexiconRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LexiconRequestError";
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  vi: "Vietnamese",
  ja: "Japanese",
  ko: "Korean",
};

export function normalizeLanguageCode(value: string): string {
  const normalized = value.trim().toLowerCase().split("-")[0];
  if (!/^[a-z]{2,3}$/u.test(normalized)) {
    throw new Error("INVALID_LANGUAGE");
  }
  return normalized;
}

export function detectLikelyLanguage(value: string): string | null {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) return "ja";
  if (/\p{Script=Hangul}/u.test(value)) return "ko";
  return null;
}

export function validateTermLanguage(
  term: string,
  sourceLanguage: string,
  targetLanguage: string,
): void {
  const source = normalizeLanguageCode(sourceLanguage);
  const detected = detectLikelyLanguage(term);
  if (!detected || detected === source) return;

  const detectedName = LANGUAGE_NAMES[detected] ?? detected;
  const sourceName = LANGUAGE_NAMES[source] ?? source;
  const target = normalizeLanguageCode(targetLanguage);
  const targetName = LANGUAGE_NAMES[target] ?? target;
  throw new LexiconRequestError(
    "LANGUAGE_MISMATCH",
    `This word appears to be ${detectedName}, but this deck searches ${sourceName}. Choose a ${detectedName} → ${targetName} deck.`,
    422,
  );
}

export function validateDeckLanguage(
  itemLanguage: string,
  deckLanguage: string,
  label: string,
): void {
  if (
    normalizeLanguageCode(itemLanguage) === normalizeLanguageCode(deckLanguage)
  ) return;
  throw new LexiconRequestError(
    "LANGUAGE_MISMATCH",
    `The selected vocabulary ${label} does not match the deck language.`,
    422,
  );
}
