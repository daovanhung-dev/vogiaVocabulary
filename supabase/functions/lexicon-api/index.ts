import { authenticatedUser } from "../_shared/auth.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  readBody,
  requestId,
} from "../_shared/http.ts";
import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.8";
import { normalizeTerm } from "./services/normalize.ts";
import {
  LexiconSearchRequest,
  LexiconSearchResult,
} from "./providers/provider.interface.ts";
import { WiktionaryProvider } from "./providers/wiktionary.provider.ts";

const provider = new WiktionaryProvider();

Deno.serve(async (request: Request) => {
  const id = requestId();
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { user, admin } = await authenticatedUser(request);
    const body = await readBody(request);
    const url = new URL(request.url);
    const route = String(
      body["route"] ?? url.pathname.split("/").filter(Boolean).pop() ??
        "search",
    );

    if (route === "search" || route === "details") {
      const query = String(
        body["query"] ?? url.searchParams.get("query") ?? body["term"] ??
          url.searchParams.get("term") ?? "",
      ).trim();
      const sourceLanguage = String(
        body["sourceLanguage"] ?? url.searchParams.get("sourceLanguage") ??
          "en",
      );
      const targetLanguage = String(
        body["targetLanguage"] ?? url.searchParams.get("targetLanguage") ??
          "vi",
      );
      if (!query) {
        return errorResponse(
          "INVALID_REQUEST",
          "A search query is required.",
          id,
          400,
        );
      }
      const searchRequest: LexiconSearchRequest = {
        query,
        sourceLanguage,
        targetLanguage,
      };
      if (route === "details") {
        return jsonResponse(
          await provider.getDetails({ ...searchRequest, term: query }),
        );
      }

      const cacheKey = normalizeTerm(query, sourceLanguage);
      const cached = await admin.from("lexicon_cache").select("result").eq(
        "query",
        cacheKey,
      ).eq("language_code", sourceLanguage).eq(
        "target_language_code",
        targetLanguage,
      ).eq("provider", "wiktionary").gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached.data?.result) return jsonResponse(cached.data.result);

      const results = await provider.search(searchRequest);
      const payload = { results };
      await admin.from("lexicon_cache").upsert({
        query: cacheKey,
        language_code: sourceLanguage,
        target_language_code: targetLanguage,
        provider: "wiktionary",
        result: payload,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
          .toISOString(),
      }, { onConflict: "query,language_code,target_language_code,provider" });
      return jsonResponse(payload);
    }

    if (route === "search-batch") {
      const queries = Array.isArray(body["queries"])
        ? body["queries"].map(String).map((value) => value.trim()).filter(
          Boolean,
        ).slice(0, 100)
        : [];
      const sourceLanguage = String(body["sourceLanguage"] ?? "en");
      const targetLanguage = String(body["targetLanguage"] ?? "vi");
      const results: Record<string, LexiconSearchResult[]> = {};
      for (const query of queries) {
        results[query] = await searchWithCache(admin, {
          query,
          sourceLanguage,
          targetLanguage,
        });
      }
      return jsonResponse({ results });
    }

    if (route === "import") {
      const deckId = String(body["deckId"] ?? "");
      const rawItems = Array.isArray(body["items"])
        ? body["items"].slice(0, 100)
        : [];
      if (!deckId || !rawItems.length) {
        return errorResponse(
          "INVALID_REQUEST",
          "deckId and at least one item are required.",
          id,
          400,
        );
      }
      const ownership = await admin.from("decks").select(
        "id, source_language_id, target_language_id",
      ).eq("id", deckId).eq("user_id", user.id).eq("is_archived", false)
        .maybeSingle();
      if (!ownership.data) {
        return errorResponse(
          "DECK_NOT_FOUND",
          "The requested deck was not found.",
          id,
          404,
        );
      }
      const languageIds = [
        ownership.data.source_language_id,
        ownership.data.target_language_id,
      ];
      const languageRows = await admin.from("languages").select("id, code").in(
        "id",
        languageIds,
      );
      const languageCodes = new Map(
        (languageRows.data ?? []).map((
          language,
        ) => [language.id, language.code]),
      );
      const deckSourceLanguage =
        languageCodes.get(ownership.data.source_language_id) ?? "en";
      const deckTargetLanguage =
        languageCodes.get(ownership.data.target_language_id) ?? "vi";
      const items = [];
      for (const raw of rawItems) {
        const item = raw as Record<string, unknown>;
        const sourceLanguage = String(
          item["languageCode"] ?? deckSourceLanguage,
        );
        const targetLanguage = String(
          item["targetLanguageCode"] ?? body["targetLanguage"] ??
            deckTargetLanguage,
        );
        const term = String(item["term"] ?? "").trim();
        if (!term) continue;
        const detailed = Array.isArray(item["senses"]) && item["senses"].length
          ? item
          : await provider.getDetails({
            query: term,
            sourceLanguage,
            targetLanguage,
            term,
          });
        items.push({
          ...detailed,
          languageCode: sourceLanguage,
          targetLanguageCode: targetLanguage,
          normalizedTerm: normalizeTerm(term, sourceLanguage),
        });
      }
      const { data, error } = await admin.rpc("import_vocabulary_batch", {
        p_user_id: user.id,
        p_deck_id: deckId,
        p_items: items,
      });
      if (error) throw new Error(error.message);
      return jsonResponse(data ?? { inserted: 0, duplicate: 0, failed: 0 });
    }

    return errorResponse(
      "INVALID_REQUEST",
      `Unknown lexicon route: ${route}`,
      id,
      400,
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Lexicon request failed.";
    const code = message.startsWith("SUPABASE_CONFIG_MISSING")
      ? "SUPABASE_CONFIG_MISSING"
      : message === "AUTH_REQUIRED"
      ? "AUTH_REQUIRED"
      : message === "INVALID_LANGUAGE"
      ? "INVALID_LANGUAGE"
      : message.startsWith("LEXICON_PROVIDER_")
      ? "LEXICON_PROVIDER_TIMEOUT"
      : "LEXICON_PROVIDER_FAILED";
    return errorResponse(
      code,
      message,
      id,
      code === "AUTH_REQUIRED"
        ? 401
        : code === "SUPABASE_CONFIG_MISSING"
        ? 500
        : 502,
    );
  }
});

async function searchWithCache(
  admin: SupabaseClient,
  request: LexiconSearchRequest,
): Promise<LexiconSearchResult[]> {
  const cacheKey = normalizeTerm(request.query, request.sourceLanguage);
  const cached = await admin.from("lexicon_cache").select("result").eq(
    "query",
    cacheKey,
  ).eq("language_code", request.sourceLanguage).eq(
    "target_language_code",
    request.targetLanguage,
  ).eq("provider", "wiktionary").gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (
    cached.data?.result && typeof cached.data.result === "object" &&
    "results" in cached.data.result
  ) return (cached.data.result as { results: LexiconSearchResult[] }).results;
  const results = await provider.search(request);
  await admin.from("lexicon_cache").upsert({
    query: cacheKey,
    language_code: request.sourceLanguage,
    target_language_code: request.targetLanguage,
    provider: "wiktionary",
    result: { results },
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  }, { onConflict: "query,language_code,target_language_code,provider" });
  return results;
}
