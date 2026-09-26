export const SUPPORTED_EXERCISE_TYPES = [
  "flashcard",
  "multiple_choice_meaning",
  "multiple_choice_term",
  "typing_meaning",
  "typing_term",
  "translation",
  "reverse_translation",
  "fill_blank",
  "true_false",
  "context_choice",
  "scrambled_letters",
  "matching_pairs",
  "odd_one_out",
  "example_choice",
  "context_cloze",
] as const;

export type GeneratedExerciseType = typeof SUPPORTED_EXERCISE_TYPES[number];

export interface VocabularyContext {
  id: string;
  term: string;
  meanings: string[];
  translations: string[];
  examples: string[];
}

export interface ExerciseGenerationOptions {
  count: number;
  modes: string[];
  difficulty: "easy" | "adaptive" | "hard";
  direction: "source_to_target" | "target_to_source";
}

export interface GeneratedQuestionDraft {
  deckItemId: string;
  type: GeneratedExerciseType;
  prompt: string;
  choices: string[];
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
  difficulty: number;
  payload: Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

const DEFAULT_DETERMINISTIC_TYPES: GeneratedExerciseType[] = [
  "multiple_choice_meaning",
  "typing_meaning",
  "flashcard",
  "matching_pairs",
];

const QUESTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          deckItemId: { type: "STRING" },
          type: { type: "STRING", enum: [...SUPPORTED_EXERCISE_TYPES] },
          prompt: { type: "STRING" },
          choices: { type: "ARRAY", items: { type: "STRING" } },
          answer: { type: "STRING" },
          acceptedAnswers: { type: "ARRAY", items: { type: "STRING" } },
          explanation: { type: "STRING" },
          difficulty: { type: "INTEGER", minimum: 1, maximum: 5 },
          payload: {
            type: "OBJECT",
            properties: {
              sentence: { type: "STRING" },
              blank: { type: "STRING" },
              pairs: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    left: { type: "STRING" },
                    right: { type: "STRING" },
                  },
                  required: ["left", "right"],
                },
              },
            },
          },
        },
        required: [
          "deckItemId",
          "type",
          "prompt",
          "choices",
          "answer",
          "acceptedAnswers",
          "explanation",
          "difficulty",
          "payload",
        ],
      },
    },
  },
  required: ["questions"],
};

export class GeminiExerciseProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async generate(
    vocabulary: VocabularyContext[],
    options: ExerciseGenerationOptions,
  ): Promise<unknown> {
    const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

    const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${
      encodeURIComponent(model)
    }:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text:
                "You create language-learning exercises. Use only the supplied vocabulary IDs and facts. Never invent a deckItemId. Return exactly the requested number of questions. Keep explanations concise and learner-friendly.",
            }],
          },
          contents: [{ role: "user", parts: [{ text: buildPrompt(vocabulary, options) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: QUESTION_SCHEMA,
            temperature: 0.7,
            maxOutputTokens: Math.min(65_536, Math.max(8_192, options.count * 220)),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("GEMINI_RATE_LIMITED");
        throw new Error(`GEMINI_PROVIDER_${response.status}`);
      }

      const payload = await response.json() as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.find((part) =>
        typeof part.text === "string"
      )?.text;
      if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new Error("GEMINI_INVALID_JSON");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("GEMINI_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function validateGeneratedQuestions(
  value: unknown,
  vocabulary: VocabularyContext[],
  options: ExerciseGenerationOptions,
): GeneratedQuestionDraft[] {
  const raw = value && typeof value === "object" && "questions" in value
    ? (value as { questions?: unknown }).questions
    : value;
  if (!Array.isArray(raw) || raw.length !== options.count) {
    throw new Error("AI_INVALID_QUESTION_COUNT");
  }

  const allowed = new Set(options.modes.length ? options.modes : SUPPORTED_EXERCISE_TYPES);
  const vocabularyById = new Map(vocabulary.map((item) => [item.id, item]));
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error("AI_INVALID_QUESTION");
    const question = entry as Record<string, unknown>;
    const deckItemId = stringValue(question.deckItemId);
    const type = stringValue(question.type) as GeneratedExerciseType;
    const context = vocabularyById.get(deckItemId);
    if (!context || !isSupportedType(type) || !allowed.has(type)) {
      throw new Error("AI_INVALID_QUESTION_REFERENCE");
    }

    const prompt = boundedString(question.prompt, 400);
    const answer = boundedString(question.answer, 300);
    const explanation = boundedString(question.explanation, 500);
    const choices = stringArray(question.choices, 8);
    const acceptedAnswers = uniqueStrings([
      answer,
      ...stringArray(question.acceptedAnswers, 8),
    ]).slice(0, 8);
    const key = `${deckItemId}:${type}:${prompt.toLocaleLowerCase()}`;
    if (seen.has(key)) throw new Error("AI_DUPLICATE_QUESTION");
    seen.add(key);

    if (isChoiceType(type) && (choices.length < 2 || !choices.includes(answer))) {
      throw new Error("AI_INVALID_CHOICES");
    }
    if (type === "matching_pairs" && !hasPairs(question.payload)) {
      throw new Error("AI_INVALID_MATCHING_PAYLOAD");
    }

    const payload = question.payload && typeof question.payload === "object"
      ? question.payload as Record<string, unknown>
      : {};
    return {
      deckItemId,
      type,
      prompt,
      answer,
      choices,
      acceptedAnswers,
      explanation,
      difficulty: clampInteger(question.difficulty, 1, 5, 3),
      payload,
    };
  });
}

export function validateQuestionCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(count) || count < 10 || count > 100) {
    throw new Error("INVALID_QUESTION_COUNT");
  }
  return count;
}

export function buildDeterministicQuestions(
  vocabulary: VocabularyContext[],
  count: number,
  modes: string[],
): GeneratedQuestionDraft[] {
  const types = (modes.filter(isSupportedType) as GeneratedExerciseType[]);
  const selectedTypes = types.length ? types : DEFAULT_DETERMINISTIC_TYPES;
  return Array.from({ length: count }, (_, index) => {
    const item = vocabulary[index % vocabulary.length];
    const meaning = item.meanings[0] || item.translations[0] || "No meaning available";
    const type = selectedTypes[index % selectedTypes.length];
    const otherMeanings = vocabulary
      .filter((candidate) => candidate.id !== item.id)
      .map((candidate) => candidate.meanings[0] || candidate.translations[0])
      .filter(Boolean)
      .slice(0, 3);
    const choices = type === "multiple_choice_meaning" || type === "context_choice"
      ? shuffle([meaning, ...otherMeanings])
      : type === "multiple_choice_term"
      ? shuffle([item.term, ...vocabulary.filter((candidate) => candidate.id !== item.id).map((candidate) => candidate.term).slice(0, 3)])
      : type === "true_false"
      ? ["True", "False"]
      : [];
    const answer = type === "multiple_choice_term" ? item.term : type === "true_false" ? "True" : meaning;
    return {
      deckItemId: item.id,
      type,
      prompt: promptFor(type, item.term, meaning),
      choices,
      answer,
      acceptedAnswers: [answer],
      explanation: `${item.term} means ${meaning}.`,
      difficulty: 3,
      payload: type === "matching_pairs"
        ? { pairs: [{ left: item.term, right: meaning }] }
        : {},
    };
  });
}

export function isSupportedType(value: string): value is GeneratedExerciseType {
  return (SUPPORTED_EXERCISE_TYPES as readonly string[]).includes(value);
}

export function isChoiceType(type: string): boolean {
  return [
    "multiple_choice_meaning",
    "multiple_choice_term",
    "context_choice",
    "true_false",
    "odd_one_out",
    "example_choice",
  ].includes(type);
}

function buildPrompt(
  vocabulary: VocabularyContext[],
  options: ExerciseGenerationOptions,
): string {
  const modes = options.modes.length ? options.modes.join(", ") : "auto mix all supported types";
  return [
    `Create exactly ${options.count} language-learning questions.`,
    `Difficulty: ${options.difficulty}. Direction: ${options.direction}.`,
    `Allowed game types: ${modes}.`,
    "Use the vocabulary records below as the only source of truth.",
    "For choice questions, include 2 to 5 choices and set answer to one exact choice.",
    "For matching_pairs, payload.pairs must contain at least one left/right pair.",
    "For text questions, acceptedAnswers may include spelling and capitalization variants.",
    JSON.stringify(vocabulary),
  ].join("\n");
}

function promptFor(type: GeneratedExerciseType, term: string, meaning: string): string {
  switch (type) {
    case "flashcard": return `Recall the meaning of “${term}”.`;
    case "multiple_choice_term": return `Which word means “${meaning}”?`;
    case "typing_term": return `Type the word for “${meaning}”.`;
    case "translation": return `Translate “${term}”.`;
    case "reverse_translation": return `Translate “${meaning}” back to the source language.`;
    case "fill_blank": return `Fill in the meaning of “${term}”.`;
    default: return `What does “${term}” mean?`;
  }
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("AI_INVALID_STRING");
  return value.trim();
}

function boundedString(value: unknown, maxLength: number): string {
  const result = stringValue(value);
  if (result.length > maxLength) throw new Error("AI_FIELD_TOO_LONG");
  return result;
}

function stringArray(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)).slice(0, maxLength);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

function hasPairs(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { pairs?: unknown }).pairs) && ((value as { pairs: unknown[] }).pairs.length > 0));
}

function shuffle<T>(values: T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5);
}
