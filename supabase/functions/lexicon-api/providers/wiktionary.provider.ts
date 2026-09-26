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

interface DefinitionEntry {
  partOfSpeech?: string;
  senses?: LegacyDefinitionSense[];
  definitions?: ModernDefinition[];
}

type DefinitionResponse = Record<string, DefinitionEntry[]>;

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
    const detailed = await Promise.all(
      titles.slice(0, 8).map(async (term) => {
        try {
          return await this.getDetails({ ...request, term });
        } catch {
          return this.emptyResult(term, request);
        }
      }),
    );
    return [
      ...detailed,
      ...titles.slice(8).map((term) => this.emptyResult(term, request)),
    ];
  }

  async getDetails(
    request: LexiconSearchRequest & { term: string },
  ): Promise<LexiconSearchResult> {
    const language = this.languageCode(request.sourceLanguage);
    const url = new URL(
      `https://${language}.wiktionary.org/api/rest_v1/page/definition/${
        encodeURIComponent(request.term)
      }`,
    );
    const payload = await this.fetchJson<DefinitionResponse>(url);
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
              ...(definition.parsedExamples ?? []).map((example) => example.example ?? ""),
            ],
          );
        });
        return;
      }

      (entry.senses ?? []).forEach((sense, index) => {
        this.pushSense(
          senses,
          request,
          entry.partOfSpeech ?? sense.raw_tags?.[0] ?? null,
          sense.glosses?.[0],
          index,
          (sense.examples ?? []).map((example) => example.text ?? ""),
        );
      });
    });
    return {
      term: request.term,
      normalizedTerm: normalizeTerm(request.term, request.sourceLanguage),
      languageCode: request.sourceLanguage,
      romanization: null,
      phonetic: null,
      audioUrl: null,
      source: "wiktionary",
      sourceReference: `https://${language}.wiktionary.org/wiki/${
        encodeURIComponent(request.term)
      }`,
      sourcePayload: payload,
      senses: senses.slice(0, 12),
    };
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
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`LEXICON_PROVIDER_${response.status}`);
      return await response.json() as T;
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
    senses.push({
      partOfSpeech,
      definition,
      definitionLanguageCode: request.sourceLanguage,
      orderIndex,
      source: "wiktionary",
      translations: [{
        translation: definition,
        targetLanguageCode: request.targetLanguage,
        source: "wiktionary-gloss",
        confidence: 0.55,
      }],
      examples: rawExamples.map(stripWikiText).filter(Boolean).map((sentence) => ({
        sentence,
        sentenceTranslation: null,
        languageCode: request.sourceLanguage,
        source: "wiktionary",
      })),
    });
  }
}

function stripWikiText(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .trim();
}
