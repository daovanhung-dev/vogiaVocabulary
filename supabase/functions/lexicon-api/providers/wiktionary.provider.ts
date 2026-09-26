import { normalizeTerm } from "../services/normalize.ts";
import {
  LexiconProvider,
  LexiconSearchRequest,
  LexiconSearchResult,
  ProviderSense,
} from "./provider.interface.ts";

interface SearchApiResponse {
  query?: { search?: Array<{ title: string; snippet?: string }> };
}

interface LegacyDefinitionSense {
  glosses?: string[];
  raw_tags?: string[];
  tags?: string[];
  examples?: Array<{ text?: string; ref?: string }>;
}

interface ModernDefinition {
  definition?: string;
  examples?: string[];
  parsedExamples?: Array<{ example?: string }>;
}

interface PronunciationEntry {
  ipa?: string;
  phonetic?: string;
  romanization?: string;
  audio?: string;
  audioUrl?: string;
}

interface DefinitionEntry {
  partOfSpeech?: string;
  senses?: LegacyDefinitionSense[];
  definitions?: ModernDefinition[];
  pronunciations?: PronunciationEntry[];
  pronunciation?: PronunciationEntry | PronunciationEntry[];
}

type DefinitionResponse = Record<string, DefinitionEntry[]>;

interface ParseResponse {
  parse?: {
    wikitext?: { "*"?: string };
  };
}

interface WikitextMetadata {
  phonetic: string | null;
  romanization: string | null;
  audioUrl: string | null;
  translations: string[][];
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "english",
  vi: "vietnamese",
  ja: "japanese",
  ko: "korean",
};

export class WiktionaryProvider implements LexiconProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async search(request: LexiconSearchRequest): Promise<LexiconSearchResult[]> {
    const language = this.languageCode(request.sourceLanguage);
    const url = new URL(`https://${language}.wiktionary.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", request.query);
    url.searchParams.set("srlimit", "20");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await this.fetchJson<SearchApiResponse>(url);
    const titles = payload.query?.search?.map((item) => item.title) ?? [];
    const queryKey = normalizeTerm(request.query, request.sourceLanguage);
    const prioritizedTitles = [
      ...titles.filter((term) =>
        normalizeTerm(term, request.sourceLanguage) === queryKey
      ),
      ...titles.filter((term) =>
        normalizeTerm(term, request.sourceLanguage) !== queryKey
      ),
    ];
    const detailed: LexiconSearchResult[] = [];
    for (const term of prioritizedTitles.slice(0, 4)) {
      try {
        detailed.push(await this.getDetails({ ...request, term }));
      } catch {
        detailed.push(this.emptyResult(term, request));
      }
    }
    return [
      ...detailed,
      ...prioritizedTitles.slice(4).map((term) =>
        this.emptyResult(term, request)
      ),
    ];
  }

  async getDetails(
    request: LexiconSearchRequest & { term: string },
  ): Promise<LexiconSearchResult> {
    const language = this.languageCode(request.sourceLanguage);
    let payload: DefinitionResponse | ParseResponse;
    try {
      const url = new URL(
        `https://${language}.wiktionary.org/api/rest_v1/page/definition/${
          encodeURIComponent(request.term)
        }`,
      );
      payload = await this.fetchJson<DefinitionResponse>(url);
    } catch (error) {
      if (language !== "ja" || !isDefinitionFallbackError(error)) throw error;
      payload = await this.fetchJapaneseWikitext(request);
    }

    if (isParseResponse(payload)) {
      return this.fromWikitext(request, language, payload);
    }

    const entries = payload[language] ?? Object.values(payload)[0] ?? [];
    const senses: ProviderSense[] = [];
    entries.forEach((entry) => {
      const modernDefinitions = entry.definitions ?? [];
      if (modernDefinitions.length) {
        modernDefinitions.forEach((definition, index) => {
          this.pushSense(
            senses,
            request,
            entry.partOfSpeech ?? null,
            definition.definition,
            index,
            [
              ...(definition.examples ?? []),
              ...(definition.parsedExamples ?? []).map((example) =>
                example.example ?? ""
              ),
            ],
          );
        });
        return;
      }

      (entry.senses ?? []).forEach((sense, senseIndex) => {
        (sense.glosses ?? []).forEach((gloss, glossIndex) => {
          this.pushSense(
            senses,
            request,
            entry.partOfSpeech ?? sense.raw_tags?.[0] ?? null,
            gloss,
            senseIndex + glossIndex,
            (sense.examples ?? []).map((example) => example.text ?? ""),
          );
        });
      });
    });

    const restMetadata = extractRestMetadata(entries);
    const wikitextMetadata = await this.tryFetchWikitextMetadata(
      request,
      language,
    );
    const metadata = mergeMetadata(restMetadata, wikitextMetadata);
    return this.withTranslations({
      term: request.term,
      normalizedTerm: normalizeTerm(request.term, request.sourceLanguage),
      languageCode: request.sourceLanguage,
      romanization: metadata.romanization,
      phonetic: metadata.phonetic,
      audioUrl: metadata.audioUrl,
      source: "wiktionary",
      sourceReference: `https://${language}.wiktionary.org/wiki/${
        encodeURIComponent(request.term)
      }`,
      sourcePayload: payload,
      senses: senses.slice(0, 12),
    }, metadata.translations, request);
  }

  private async fetchJapaneseWikitext(
    request: LexiconSearchRequest & { term: string },
  ): Promise<ParseResponse> {
    const url = new URL("https://ja.wiktionary.org/w/api.php");
    url.searchParams.set("action", "parse");
    url.searchParams.set("page", request.term);
    url.searchParams.set("prop", "wikitext");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    return await this.fetchJson<ParseResponse>(url);
  }

  private async tryFetchWikitextMetadata(
    request: LexiconSearchRequest & { term: string },
    language: string,
  ): Promise<WikitextMetadata | null> {
    try {
      const payload = await this.fetchWikitext(request, language);
      return isParseResponse(payload)
        ? parseWikitextMetadata(
          payload.parse?.wikitext?.["*"] ?? "",
          language,
          this.languageCode(request.targetLanguage),
        )
        : null;
    } catch {
      return null;
    }
  }

  private async fetchWikitext(
    request: LexiconSearchRequest & { term: string },
    language: string,
  ): Promise<ParseResponse> {
    const url = new URL(`https://${language}.wiktionary.org/w/api.php`);
    url.searchParams.set("action", "parse");
    url.searchParams.set("page", request.term);
    url.searchParams.set("prop", "wikitext");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    return await this.fetchJson<ParseResponse>(url);
  }

  private fromWikitext(
    request: LexiconSearchRequest & { term: string },
    language: string,
    payload: ParseResponse,
  ): LexiconSearchResult {
    const wikitext = payload.parse?.wikitext?.["*"] ?? "";
    const metadata = parseWikitextMetadata(
      wikitext,
      language,
      this.languageCode(request.targetLanguage),
    );
    const senses: ProviderSense[] = [];
    const lines = wikitext.split(/\r?\n/u);
    let inLanguageSection = false;
    let inDefinitionSection = false;
    let partOfSpeech: string | null = null;
    let orderIndex = 0;
    const examples: string[] = [];

    for (const line of lines) {
      const languageHeading = readHeading(line, 2);
      if (languageHeading) {
        inLanguageSection = isLanguageHeading(languageHeading, language);
        inDefinitionSection = false;
        partOfSpeech = null;
        continue;
      }
      if (!inLanguageSection) continue;

      const sectionHeading = readSubHeading(line);
      if (sectionHeading) {
        inDefinitionSection = !isNonDefinitionSection(sectionHeading);
        partOfSpeech = inDefinitionSection
          ? parsePartOfSpeech(sectionHeading)
          : null;
        continue;
      }
      if (!inDefinitionSection) continue;

      if (/^#[*:]+\s*/u.test(line)) {
        const example = stripWikiText(line.replace(/^#[*:]+\s*/u, ""));
        if (example) examples.push(example);
      } else if (/^#\s*/u.test(line) && !/^##/u.test(line)) {
        const definition = stripWikiText(line.replace(/^#\s*/u, ""));
        if (definition) {
          senses.push(
            this.buildSense(
              request,
              partOfSpeech,
              definition,
              orderIndex,
              examples.splice(0),
              [],
            ),
          );
          orderIndex += 1;
        }
      }
    }

    if (examples.length && senses.length) {
      senses[senses.length - 1].examples.push(...uniqueNonEmpty(examples).map((sentence) => ({
        sentence,
        sentenceTranslation: null,
        languageCode: request.sourceLanguage,
        source: "wiktionary",
      })));
    }

    return this.withTranslations({
      term: request.term,
      normalizedTerm: normalizeTerm(request.term, request.sourceLanguage),
      languageCode: request.sourceLanguage,
      romanization: metadata.romanization,
      phonetic: metadata.phonetic,
      audioUrl: metadata.audioUrl,
      source: "wiktionary",
      sourceReference: `https://${language}.wiktionary.org/wiki/${
        encodeURIComponent(request.term)
      }`,
      sourcePayload: payload as Record<string, unknown>,
      senses: senses.slice(0, 12),
    }, metadata.translations, request);
  }

  private emptyResult(
    term: string,
    request: LexiconSearchRequest,
  ): LexiconSearchResult {
    const language = this.languageCode(request.sourceLanguage);
    return {
      term,
      normalizedTerm: normalizeTerm(term, request.sourceLanguage),
      languageCode: request.sourceLanguage,
      romanization: null,
      phonetic: null,
      audioUrl: null,
      source: "wiktionary",
      sourceReference: `https://${language}.wiktionary.org/wiki/${
        encodeURIComponent(term)
      }`,
      senses: [],
    };
  }

  private languageCode(value: string): string {
    const normalized = value.trim().toLowerCase().split("-")[0];
    if (!/^[a-z]{2,3}$/u.test(normalized)) throw new Error("INVALID_LANGUAGE");
    return normalized;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await this.fetchImpl(url, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (response.ok) return await response.json() as T;
        if (response.status !== 429 || attempt === 2) {
          throw new Error(`LEXICON_PROVIDER_${response.status}`);
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 250 * (attempt + 1))
        );
      }
      throw new Error("LEXICON_PROVIDER_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }

  private pushSense(
    senses: ProviderSense[],
    request: LexiconSearchRequest & { term: string },
    partOfSpeech: string | null,
    rawDefinition: string | undefined,
    orderIndex: number,
    rawExamples: string[],
  ): void {
    const definition = stripWikiText(rawDefinition ?? "");
    if (!definition) return;
    senses.push(
      this.buildSense(request, partOfSpeech, definition, orderIndex, rawExamples, []),
    );
  }

  private buildSense(
    request: LexiconSearchRequest & { term: string },
    partOfSpeech: string | null,
    definition: string,
    orderIndex: number,
    rawExamples: string[],
    translations: string[],
  ): ProviderSense {
    return {
      partOfSpeech,
      definition,
      definitionLanguageCode: request.sourceLanguage,
      orderIndex,
      source: "wiktionary",
      translations: translations.map((translation) => ({
        translation,
        targetLanguageCode: request.targetLanguage,
        source: "wiktionary",
        confidence: 0.85,
      })),
      examples: uniqueNonEmpty(rawExamples.map(stripWikiText)).map((sentence) => ({
        sentence,
        sentenceTranslation: null,
        languageCode: request.sourceLanguage,
        source: "wiktionary",
      })),
    };
  }

  private withTranslations(
    result: LexiconSearchResult,
    groups: string[][],
    request: LexiconSearchRequest & { term: string },
  ): LexiconSearchResult {
    return {
      ...result,
      senses: result.senses.map((sense, index) => ({
        ...sense,
        translations: (groups[index] ?? [])
          .map((translation) => ({
            translation,
            targetLanguageCode: request.targetLanguage,
            source: "wiktionary",
            confidence: 0.85,
          })),
      })),
    };
  }
}

function extractRestMetadata(entries: DefinitionEntry[]): WikitextMetadata {
  const metadata: WikitextMetadata = {
    phonetic: null,
    romanization: null,
    audioUrl: null,
    translations: [],
  };
  for (const entry of entries) {
    const pronunciationValues = [
      ...(entry.pronunciations ?? []),
      ...(Array.isArray(entry.pronunciation)
        ? entry.pronunciation
        : entry.pronunciation
        ? [entry.pronunciation]
        : []),
    ];
    for (const pronunciation of pronunciationValues) {
      metadata.phonetic ??= cleanMetadataValue(pronunciation.ipa);
      metadata.phonetic ??= cleanMetadataValue(pronunciation.phonetic);
      metadata.romanization ??= cleanMetadataValue(pronunciation.romanization);
      metadata.audioUrl ??= normalizeAudioUrl(
        pronunciation.audioUrl ?? pronunciation.audio,
      );
    }
  }
  return metadata;
}

function mergeMetadata(
  first: WikitextMetadata,
  second: WikitextMetadata | null,
): WikitextMetadata {
  if (!second) return first;
  return {
    phonetic: first.phonetic ?? second.phonetic,
    romanization: first.romanization ?? second.romanization,
    audioUrl: first.audioUrl ?? second.audioUrl,
    translations: second.translations.length
      ? second.translations
      : first.translations,
  };
}

function parseWikitextMetadata(
  wikitext: string,
  sourceLanguage: string,
  targetLanguage: string,
): WikitextMetadata {
  const metadata: WikitextMetadata = {
    phonetic: null,
    romanization: null,
    audioUrl: null,
    translations: [],
  };
  const lines = wikitext.split(/\r?\n/u);
  let inLanguageSection = false;
  let inPronunciationSection = false;
  let inTranslationSection = false;
  let currentTranslations: string[] | null = null;

  for (const line of lines) {
    const languageHeading = readHeading(line, 2);
    if (languageHeading) {
      inLanguageSection = isLanguageHeading(languageHeading, sourceLanguage);
      inPronunciationSection = false;
      inTranslationSection = false;
      currentTranslations = null;
      continue;
    }
    if (!inLanguageSection) continue;

    const sectionHeading = readSubHeading(line);
    if (sectionHeading) {
      inPronunciationSection = /pronunciation|\{\{pron\b/iu.test(sectionHeading);
      inTranslationSection = /translation|\{\{trans\b/iu.test(sectionHeading);
      currentTranslations = null;
      continue;
    }

    if (inPronunciationSection) {
      const pronunciation = parseIpa(line, sourceLanguage);
      metadata.phonetic ??= pronunciation;
      metadata.audioUrl ??= parseAudio(line, sourceLanguage);
      if (sourceLanguage === "ja") {
        const explicitRomanization = line.match(/\|(?:tr|romaji)=([^|}]+)/iu)?.[1];
        const kana = line.match(/\{\{ja-pron\|([^|}]+)/u)?.[1];
        metadata.romanization ??= cleanMetadataValue(explicitRomanization);
        metadata.romanization ??= kana ? kanaToRomaji(stripWikiText(kana)) : null;
      }
    }

    if (!inTranslationSection) continue;
    if (/\{\{trans-top\b/iu.test(line)) {
      currentTranslations = [];
      continue;
    }
    if (/\{\{trans-bottom\b/iu.test(line)) {
      if (currentTranslations?.length) metadata.translations.push(currentTranslations);
      currentTranslations = null;
      continue;
    }
    if (!currentTranslations) continue;
    currentTranslations.push(...parseTranslations(line, targetLanguage));
  }

  if (currentTranslations?.length) metadata.translations.push(currentTranslations);
  return metadata;
}

function parseIpa(line: string, language: string): string | null {
  const escapedLanguage = escapeRegExp(language);
  const match = line.match(
    new RegExp(`\\{\\{IPA\\|${escapedLanguage}\\|([^}]+)\\}\\}`, "iu"),
  );
  if (!match) return null;
  const values = match[1].split("|")
    .filter((value) => !value.includes("="))
    .map((value) => stripWikiText(value))
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)).join(" · ") : null;
}

function parseAudio(line: string, language: string): string | null {
  const escapedLanguage = escapeRegExp(language);
  const match = line.match(
    new RegExp(`\\{\\{audio\\|${escapedLanguage}\\|([^|}]+)`, "iu"),
  );
  return match ? normalizeAudioUrl(match[1]) : null;
}

function parseTranslations(line: string, targetLanguage: string): string[] {
  const escapedLanguage = escapeRegExp(targetLanguage);
  const expression = new RegExp(
    `\\{\\{(?:t|tt|t\\+|tt\\+)\\|${escapedLanguage}\\|([^|}]+)`,
    "giu",
  );
  return Array.from(line.matchAll(expression))
    .map((match) => stripWikiText(match[1]))
    .filter(Boolean);
}

function readHeading(line: string, level: number): string | null {
  const marker = "=".repeat(level);
  const expression = new RegExp(`^${marker}(?![=])\\s*(.*?)\\s*(?<![=])${marker}$`, "u");
  return line.match(expression)?.[1] ?? null;
}

function readSubHeading(line: string): string | null {
  const match = line.match(/^={3,6}\s*(.*?)\s*={3,6}$/u);
  return match?.[1] ?? null;
}

function isLanguageHeading(heading: string, language: string): boolean {
  const normalized = heading.toLowerCase().replace(/\s+/gu, " ").trim();
  return normalized.includes(`{{l|${language}}}`) ||
    normalized === (LANGUAGE_NAMES[language] ?? language);
}

function isNonDefinitionSection(heading: string): boolean {
  return /pronunciation|pron\b|alternative|etym|syn|rel|trans|conjug|usage|derived|coordinate|anagram/iu.test(
    heading,
  );
}

function parsePartOfSpeech(heading: string): string | null {
  const template = heading.match(/\{\{([^|}]+)(?:\|[^}]*)?\}\}/u)?.[1];
  if (template && !/^(?:L|pron|alter|etym|syn|rel|trans|conjug)$/iu.test(template)) {
    return template.replace(/[-_]/gu, " ").trim();
  }
  const cleaned = stripWikiText(heading);
  return cleaned && !isNonDefinitionSection(cleaned) ? cleaned : null;
}

function normalizeAudioUrl(value: string | undefined): string | null {
  const cleaned = cleanMetadataValue(value);
  if (!cleaned) return null;
  if (/^https?:\/\//iu.test(cleaned)) return cleaned;
  const file = cleaned.replace(/^file:/iu, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
}

function cleanMetadataValue(value: string | undefined): string | null {
  const cleaned = value ? stripWikiText(value) : "";
  return cleaned || null;
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function kanaToRomaji(value: string): string | null {
  const kana = value.replace(/[ァ-ン]/gu, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60)
  );
  const pairs: Record<string, string> = {
    きゃ: "kya", きゅ: "kyu", きょ: "kyo", しゃ: "sha", しゅ: "shu", しょ: "sho",
    ちゃ: "cha", ちゅ: "chu", ちょ: "cho", にゃ: "nya", にゅ: "nyu", にょ: "nyo",
    ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo", みゃ: "mya", みゅ: "myu", みょ: "myo",
    りゃ: "rya", りゅ: "ryu", りょ: "ryo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
    じゃ: "ja", じゅ: "ju", じょ: "jo", びゃ: "bya", びゅ: "byu", びょ: "byo",
    ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo", ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo",
    てぃ: "ti", でぃ: "di", つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso",
  };
  const singles: Record<string, string> = {
    あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
    さ: "sa", し: "shi", す: "su", せ: "se", そ: "so", た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
    な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo", ら: "ra", り: "ri",
    る: "ru", れ: "re", ろ: "ro", わ: "wa", を: "o", ん: "n", が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
    ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
    ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
    ゔ: "vu",
  };
  let result = "";
  for (let index = 0; index < kana.length; index += 1) {
    const character = kana[index];
    if (character === "っ") {
      const next = pairs[kana.slice(index + 1, index + 3)] ?? singles[kana[index + 1]] ?? "";
      result += next.charAt(0);
      continue;
    }
    if (character === "ー") continue;
    const pair = pairs[kana.slice(index, index + 2)];
    if (pair) {
      result += pair;
      index += 1;
      continue;
    }
    result += singles[character] ?? character;
  }
  return result || null;
}

function isDefinitionFallbackError(error: unknown): boolean {
  return error instanceof Error &&
    /LEXICON_PROVIDER_(404|501)/u.test(error.message);
}

function isParseResponse(
  payload: DefinitionResponse | ParseResponse,
): payload is ParseResponse {
  return typeof payload === "object" && payload !== null && "parse" in payload;
}

function stripWikiText(value: string): string {
  return value
    .replace(/<!--.*?-->/gu, " ")
    .replace(/\{\{[^{}]*\}\}/gu, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/gu, "$2")
    .replace(/\[\[([^\]]+)\]\]/gu, "$1")
    .replace(/'{2,}/gu, "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/\(\s+/gu, "(")
    .replace(/\s+\)/gu, ")")
    .trim();
}
