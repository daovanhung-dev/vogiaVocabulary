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

interface ParseResponse {
  parse?: {
    wikitext?: { "*"?: string };
  };
}

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
      return this.fromJapaneseWikitext(request, language, payload);
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

  private fromJapaneseWikitext(
    request: LexiconSearchRequest & { term: string },
    language: string,
    payload: ParseResponse,
  ): LexiconSearchResult {
    const wikitext = payload.parse?.wikitext?.["*"] ?? "";
    const senses: ProviderSense[] = [];
    const lines = wikitext.split(/\r?\n/u);
    let inJapaneseSection = false;
    let inDefinitionSection = false;
    let orderIndex = 0;
    const examples: string[] = [];

    for (const line of lines) {
      if (/^==[^=].*[^=]==$/u.test(line)) {
        inJapaneseSection = /^==[^=]*\{\{L\|ja\}\}[^=]*==$/u.test(line);
        inDefinitionSection = false;
        continue;
      }
      if (!inJapaneseSection) continue;
      if (/^===+.*===+$/u.test(line)) {
        inDefinitionSection = !/\{\{(pron|alter|etym|syn|rel|trans|conjug)\b/u
          .test(line);
        continue;
      }
      if (!inDefinitionSection) continue;
      if (/^#\s*/u.test(line) && !/^##/u.test(line)) {
        const definition = stripWikiText(line.replace(/^#\s*/u, ""));
        if (definition) {
          senses.push(
            this.buildSense(
              request,
              null,
              definition,
              orderIndex++,
              examples.splice(0),
            ),
          );
        }
      } else if (/^#[*:]+\s*/u.test(line)) {
        const example = stripWikiText(line.replace(/^#[*:]+\s*/u, ""));
        if (example) examples.push(example);
      }
    }

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
      sourcePayload: payload as Record<string, unknown>,
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
      this.buildSense(
        request,
        partOfSpeech,
        definition,
        orderIndex,
        rawExamples,
      ),
    );
  }

  private buildSense(
    request: LexiconSearchRequest & { term: string },
    partOfSpeech: string | null,
    definition: string,
    orderIndex: number,
    rawExamples: string[],
  ): ProviderSense {
    return {
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
      examples: rawExamples.map(stripWikiText).filter(Boolean).map((
        sentence,
      ) => ({
        sentence,
        sentenceTranslation: null,
        languageCode: request.sourceLanguage,
        source: "wiktionary",
      })),
    };
  }
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
    .trim();
}
