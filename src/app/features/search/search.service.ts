import { Injectable } from '@angular/core';
import Fuse from 'fuse.js';
import { LexiconSearchRequest, LexiconSearchResult, ImportResult } from '../../shared/models/domain.models';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { normalizeTerm } from '../../shared/utils/normalize';

interface SearchResponse {
  results: LexiconSearchResult[];
}

interface BatchResponse {
  results: Record<string, LexiconSearchResult[]>;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private readonly supabase: SupabaseService) {}

  async search(request: LexiconSearchRequest): Promise<LexiconSearchResult[]> {
    const { data, error } = await this.supabase.requiredClient.functions.invoke<SearchResponse>('lexicon-api', {
      body: { route: 'search', ...request },
    });
    if (error) throw error;
    const results = Array.isArray(data) ? data : data?.results ?? [];
    return this.localRank(results, request.query);
  }

  async searchBatch(queries: string[], sourceLanguage: string, targetLanguage: string): Promise<Record<string, LexiconSearchResult[]>> {
    const { data, error } = await this.supabase.requiredClient.functions.invoke<BatchResponse>('lexicon-api', {
      body: { route: 'search-batch', queries, sourceLanguage, targetLanguage },
    });
    if (error) throw error;
    return Array.isArray(data) ? Object.fromEntries(queries.map((query, index) => [query, data[index] ?? []])) : data?.results ?? {};
  }

  async importSelected(deckId: string, items: LexiconSearchResult[]): Promise<ImportResult> {
    const { data, error } = await this.supabase.requiredClient.functions.invoke<ImportResult>('lexicon-api', {
      body: { route: 'import', deckId, items },
    });
    if (error) throw error;
    return data ?? { inserted: 0, duplicate: 0, failed: items.length };
  }

  private localRank(results: LexiconSearchResult[], query: string): LexiconSearchResult[] {
    const fuse = new Fuse(results, { keys: ['term', 'romanization'], threshold: 0.42, ignoreLocation: true });
    const exact = results.filter((result) => normalizeTerm(result.term) === normalizeTerm(query));
    const fuzzy = fuse.search(query).map((result) => result.item);
    return Array.from(new Map([...exact, ...fuzzy].map((result) => [result.normalizedTerm, result])).values());
  }
}
