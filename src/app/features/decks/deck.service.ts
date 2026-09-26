import { Injectable, signal } from '@angular/core';
import { Deck, DeckItem, Language } from '../../shared/models/domain.models';
import { SupabaseService } from '../../core/supabase/supabase.service';

const LANGUAGE_PRESETS: Language[] = [
  { id: '00000000-0000-0000-0000-000000000001', code: 'en', name: 'English', native_name: 'English', bcp47: 'en', iso_639_1: 'en', iso_639_3: 'eng', script_code: 'Latn', direction: 'ltr', is_enabled: true },
  { id: '00000000-0000-0000-0000-000000000002', code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', bcp47: 'vi', iso_639_1: 'vi', iso_639_3: 'vie', script_code: 'Latn', direction: 'ltr', is_enabled: true },
  { id: '00000000-0000-0000-0000-000000000003', code: 'ja', name: 'Japanese', native_name: '日本語', bcp47: 'ja', iso_639_1: 'ja', iso_639_3: 'jpn', script_code: 'Jpan', direction: 'ltr', is_enabled: true },
  { id: '00000000-0000-0000-0000-000000000004', code: 'ko', name: 'Korean', native_name: '한국어', bcp47: 'ko', iso_639_1: 'ko', iso_639_3: 'kor', script_code: 'Kore', direction: 'ltr', is_enabled: true },
];

@Injectable({ providedIn: 'root' })
export class DeckService {
  readonly languages = signal<Language[]>([]);

  constructor(private readonly supabase: SupabaseService) {}

  async loadLanguages(): Promise<Language[]> {
    if (!this.supabase.configured) {
      this.languages.set(LANGUAGE_PRESETS);
      return LANGUAGE_PRESETS;
    }
    const { data, error } = await this.supabase.requiredClient.from('languages').select('*').eq('is_enabled', true).order('name');
    if (error) throw error;
    const languages = (data ?? []) as Language[];
    this.languages.set(languages);
    return languages;
  }

  async listDecks(): Promise<Deck[]> {
    if (!this.supabase.configured) return [];
    const { data, error } = await this.supabase.requiredClient.from('decks').select('*').eq('is_archived', false).order('created_at', { ascending: false });
    if (error) throw error;
    const languages = this.languages().length ? this.languages() : await this.loadLanguages();
    return ((data ?? []) as Deck[]).map((deck) => ({
      ...deck,
      source_language: languages.find((language) => language.id === deck.source_language_id),
      target_language: languages.find((language) => language.id === deck.target_language_id),
    }));
  }

  async getDeck(deckId: string): Promise<Deck | null> {
    if (!this.supabase.configured) return null;
    const { data, error } = await this.supabase.requiredClient.from('decks').select('*').eq('id', deckId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const languages = this.languages().length ? this.languages() : await this.loadLanguages();
    const deck = data as Deck;
    return {
      ...deck,
      source_language: languages.find((language) => language.id === deck.source_language_id),
      target_language: languages.find((language) => language.id === deck.target_language_id),
    };
  }

  async createDeck(input: Pick<Deck, 'name' | 'description' | 'source_language_id' | 'target_language_id'>): Promise<Deck> {
    const { data, error } = await this.supabase.requiredClient.from('decks').insert(input).select('*').single();
    if (error) throw error;
    return data as Deck;
  }

  async updateDeck(deckId: string, input: Pick<Deck, 'name' | 'description' | 'source_language_id' | 'target_language_id'>): Promise<void> {
    const { error } = await this.supabase.requiredClient.from('decks').update(input).eq('id', deckId);
    if (error) throw error;
  }

  async archiveDeck(deckId: string): Promise<void> {
    const { error } = await this.supabase.requiredClient.from('decks').update({ is_archived: true }).eq('id', deckId);
    if (error) throw error;
  }

  async removeDeckItem(deckItemId: string): Promise<void> {
    const { error } = await this.supabase.requiredClient.from('deck_items').delete().eq('id', deckItemId);
    if (error) throw error;
  }

  async listDeckItems(deckId: string): Promise<DeckItem[]> {
    if (!this.supabase.configured) return [];
    const { data, error } = await this.supabase.requiredClient
      .from('deck_items')
      .select('*, lexeme:lexemes(*, senses(*, translations(*), examples(*))), review_state:review_states(*)')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DeckItem[];
  }
}
