export interface Language {
  id: string;
  code: string;
  name: string;
  native_name: string;
  bcp47: string;
  iso_639_1: string | null;
  iso_639_3: string | null;
  script_code: string | null;
  direction: 'ltr' | 'rtl';
  is_enabled: boolean;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  native_language: string | null;
  timezone: string | null;
}

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_language_id: string;
  target_language_id: string;
  is_archived: boolean;
  created_at: string;
  source_language?: Language;
  target_language?: Language;
  item_count?: number;
}

export interface Lexeme {
  id: string;
  language_id: string;
  term: string;
  normalized_term: string;
  romanization: string | null;
  phonetic: string | null;
  audio_url: string | null;
  source: string | null;
  source_reference: string | null;
}

export interface Translation {
  id?: string;
  sense_id?: string;
  target_language_id?: string;
  translation: string;
  romanization?: string | null;
  source?: string | null;
  confidence?: number | null;
}

export interface Example {
  id?: string;
  sense_id?: string;
  sentence: string;
  sentence_translation: string | null;
  language_id: string;
  source?: string | null;
}

export interface Sense {
  id?: string;
  lexeme_id?: string;
  part_of_speech: string | null;
  definition: string;
  definition_language_id?: string | null;
  order_index?: number;
  source?: string | null;
  translations?: Translation[];
  examples?: Example[];
}

export interface DeckItem {
  id: string;
  deck_id: string;
  lexeme_id: string;
  preferred_translation_id: string | null;
  custom_meaning: string | null;
  custom_note: string | null;
  priority: number;
  created_at: string;
  lexeme?: Lexeme & { senses?: Sense[] };
  review_state?: ReviewState | null;
}

export interface ReviewState {
  id: string;
  user_id: string;
  deck_item_id: string;
  mastery: number;
  difficulty: number;
  stability: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
}

export interface DashboardStats {
  wordsSaved: number;
  reviewStreakDays: number;
}

export interface LexiconSearchRequest {
  query: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface LexiconTranslation {
  translation: string;
  targetLanguageCode: string;
  source: string;
  confidence: number;
}

export interface LexiconExample {
  sentence: string;
  sentenceTranslation: string | null;
  languageCode: string;
  source: string;
}

export interface LexiconSense {
  partOfSpeech: string | null;
  definition: string;
  definitionLanguageCode: string;
  orderIndex: number;
  source: string;
  translations: LexiconTranslation[];
  examples: LexiconExample[];
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
  senses: LexiconSense[];
}

export interface ImportResult {
  inserted: number;
  duplicate: number;
  failed: number;
}

export type ExerciseType =
  | 'flashcard'
  | 'multiple_choice'
  | 'typing'
  | 'matching'
  | 'multiple_choice_meaning'
  | 'multiple_choice_term'
  | 'typing_meaning'
  | 'typing_term'
  | 'translation'
  | 'reverse_translation'
  | 'fill_blank'
  | 'true_false'
  | 'context_choice'
  | 'scrambled_letters'
  | 'matching_pairs'
  | 'odd_one_out'
  | 'example_choice'
  | 'context_cloze';

export type ExerciseDifficulty = 'easy' | 'adaptive' | 'hard';
export type ExerciseDirection = 'source_to_target' | 'target_to_source';
export type ExerciseSource = 'gemini' | 'deterministic';

export interface ExerciseGenerationRequest {
  deckId: string;
  count: number;
  modes: ExerciseType[];
  difficulty: ExerciseDifficulty;
  direction: ExerciseDirection;
  title?: string;
}

export interface ExerciseGenerationResponse {
  exerciseSetId: string;
  source: ExerciseSource;
  model: string | null;
  count: number;
  questions: PracticeQuestion[];
  warning?: string;
}

export interface PracticeQuestion {
  id: string;
  type: ExerciseType;
  deckItemId: string;
  term: string;
  prompt: string;
  answer: string;
  choices: string[];
  explanation: string;
  acceptedAnswers?: string[];
  payload?: Record<string, unknown>;
  source?: ExerciseSource;
}

export interface ReviewResponse {
  reviewState: ReviewState;
  isCorrect: boolean;
}
