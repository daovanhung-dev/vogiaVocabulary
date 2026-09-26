import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.8";
import { authenticatedUser } from "../_shared/auth.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  readBody,
  requestId,
} from "../_shared/http.ts";
import {
  buildDeterministicQuestions,
  ExerciseGenerationOptions,
  GeneratedQuestionDraft,
  GeminiExerciseProvider,
  isSupportedType,
  validateQuestionCount,
  validateGeneratedQuestions,
  VocabularyContext,
} from "./exercises.ts";

const AI_QUOTA_PER_HOUR = 5;
const PROMPT_VERSION = "exercise-v1";

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
      .test(value);
}

Deno.serve(async (request: Request) => {
  const id = requestId();
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, admin } = await authenticatedUser(request);
    const body = await readBody(request);
    const route = String(
      body["route"] ??
        new URL(request.url).pathname.split("/").filter(Boolean).pop() ??
        "review",
    );

    if (route === "generate-set") {
      return await generateExerciseSet(admin, user.id, body, id);
    }
    if (route === "get-set") {
      return await getExerciseSet(admin, user.id, body, id);
    }
    if (route === "sessions") {
      return await createPracticeSession(admin, user.id, body, id);
    }
    if (route === "attempts" || route === "review") {
      return await recordAttempt(admin, user.id, body, route === "attempts", id);
    }
    if (route === "complete") {
      return await completePracticeSession(admin, user.id, body, id);
    }

    return errorResponse(
      "INVALID_REQUEST",
      `Unknown learning route: ${route}`,
      id,
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Learning request failed.";
    const code = errorCode(message);
    return errorResponse(code, publicErrorMessage(code, message), id, errorStatus(code));
  }
});

async function generateExerciseSet(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  requestIdValue: string,
): Promise<Response> {
  const deckId = String(body["deckId"] ?? "");
  if (!isUuid(deckId)) {
    return errorResponse("INVALID_REQUEST", "A valid deckId is required.", requestIdValue, 400);
  }

  const count = parseCount(body["count"]);
  const modes = parseModes(body["modes"]);
  const difficulty = parseDifficulty(body["difficulty"]);
  const direction = body["direction"] === "target_to_source"
    ? "target_to_source"
    : "source_to_target";
  const title = boundedText(body["title"], 120) || "AI vocabulary practice";

  const deck = await getOwnedDeck(admin, userId, deckId);
  if (!deck) return errorResponse("DECK_NOT_FOUND", "The requested deck was not found.", requestIdValue, 404);

  const vocabulary = await loadVocabulary(admin, deckId);
  if (!vocabulary.length) {
    return errorResponse("VOCABULARY_EMPTY", "Add vocabulary before generating a practice set.", requestIdValue, 400);
  }

  const quota = await admin.rpc("consume_ai_generation_quota", {
    p_user_id: userId,
    p_limit: AI_QUOTA_PER_HOUR,
  });
  if (quota.error) throw quota.error;
  const quotaResult = quota.data as { allowed?: boolean; remaining?: number } | null;
  if (quotaResult?.allowed === false) {
    return errorResponse(
      "AI_QUOTA_EXCEEDED",
      `You can create up to ${AI_QUOTA_PER_HOUR} AI practice sets per hour.`,
      requestIdValue,
      429,
    );
  }

  const options: ExerciseGenerationOptions = { count, modes, difficulty, direction };
  let drafts: GeneratedQuestionDraft[];
  let source: "gemini" | "deterministic" = "gemini";
  let model: string | null = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
  let warning: string | undefined;

  try {
    const raw = await new GeminiExerciseProvider().generate(vocabulary, options);
    drafts = validateGeneratedQuestions(raw, vocabulary, options);
  } catch (error) {
    source = "deterministic";
    model = null;
    warning = fallbackWarning(error instanceof Error ? error.message : "AI_FAILED");
    drafts = buildDeterministicQuestions(vocabulary, count, modes);
  }

  const persistedDrafts = drafts.map((draft) => ({
    ...draft,
    payload: {
      ...draft.payload,
      term: vocabulary.find((item) => item.id === draft.deckItemId)?.term ?? "",
    },
  }));

  const result = await admin.rpc("create_exercise_set_with_questions", {
    p_user_id: userId,
    p_deck_id: deckId,
    p_title: title,
    p_generator: source,
    p_ai_model: model,
    p_prompt_version: source === "gemini" ? PROMPT_VERSION : null,
    p_config: { count, modes, difficulty, direction, title },
    p_questions: persistedDrafts,
  });
  if (result.error) throw result.error;

  const stored = result.data as { exerciseSetId?: string; questions?: unknown[] } | null;
  const questions = stored?.questions?.map((question) =>
    toPracticeQuestion(question, vocabulary, source)
  ).filter((question): question is Record<string, unknown> => Boolean(question)) ?? [];
  if (!stored?.exerciseSetId || questions.length !== count) {
    throw new Error("EXERCISE_SET_CREATE_FAILED");
  }

  return jsonResponse({
    exerciseSetId: stored.exerciseSetId,
    source,
    model,
    count: questions.length,
    questions,
    ...(warning ? { warning } : {}),
  });
}

async function getExerciseSet(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  requestIdValue: string,
): Promise<Response> {
  const exerciseSetId = String(body["exerciseSetId"] ?? "");
  if (!isUuid(exerciseSetId)) {
    return errorResponse("INVALID_REQUEST", "A valid exerciseSetId is required.", requestIdValue, 400);
  }
  const result = await admin.from("exercise_sets").select(
    "id, generator, ai_model, exercise_questions(id, vocabulary_id, type, prompt, payload, answer, explanation, difficulty, order_index, vocabulary:deck_items(lexeme:lexemes(term)))",
  ).eq("id", exerciseSetId).eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return errorResponse("EXERCISE_SET_NOT_FOUND", "The practice set was not found.", requestIdValue, 404);
  const storedSet = result.data;

  const questions = Array.isArray(storedSet.exercise_questions)
    ? storedSet.exercise_questions.map((question: unknown) => toPracticeQuestion(
      question,
      [],
      storedSet.generator === "gemini" ? "gemini" : "deterministic",
    )).filter((question): question is Record<string, unknown> => Boolean(question))
    : [];
  return jsonResponse({
    exerciseSetId,
    source: storedSet.generator === "gemini" ? "gemini" : "deterministic",
    model: storedSet.ai_model ?? null,
    count: questions.length,
    questions,
  });
}

async function createPracticeSession(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  requestIdValue: string,
): Promise<Response> {
  const deckId = String(body["deckId"] ?? "");
  const exerciseSetId = String(body["exerciseSetId"] ?? "");
  if (!isUuid(deckId)) return errorResponse("INVALID_REQUEST", "A valid deckId is required.", requestIdValue, 400);

  const ownership = await getOwnedDeck(admin, userId, deckId);
  if (!ownership) return errorResponse("DECK_NOT_FOUND", "The requested deck was not found.", requestIdValue, 404);

  const insert: Record<string, string> = { user_id: userId, deck_id: deckId };
  if (exerciseSetId) {
    if (!isUuid(exerciseSetId)) return errorResponse("INVALID_REQUEST", "A valid exerciseSetId is required.", requestIdValue, 400);
    const set = await admin.from("exercise_sets").select("id, deck_id").eq("id", exerciseSetId).eq("user_id", userId).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data || set.data.deck_id !== deckId) return errorResponse("EXERCISE_SET_NOT_FOUND", "The practice set was not found.", requestIdValue, 404);
    insert.exercise_set_id = exerciseSetId;
  }

  const result = await admin.from("practice_sessions").insert(insert).select("id").single();
  if (result.error) throw result.error;
  return jsonResponse({ sessionId: result.data.id });
}

async function recordAttempt(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  storeAttempt: boolean,
  requestIdValue: string,
): Promise<Response> {
  const deckItemId = String(body["deckItemId"] ?? "");
  if (!isUuid(deckItemId)) return errorResponse("INVALID_REQUEST", "A valid deckItemId is required.", requestIdValue, 400);
  const isCorrect = Boolean(body["isCorrect"]);
  const responseTimeMs = Math.max(0, Number(body["responseTimeMs"] ?? 0));
  const review = await admin.rpc("record_review", {
    p_user_id: userId,
    p_deck_item_id: deckItemId,
    p_is_correct: isCorrect,
    p_response_time_ms: Number.isFinite(responseTimeMs) ? responseTimeMs : 0,
  });
  if (review.error) throw review.error;

  const sessionId = String(body["sessionId"] ?? "");
  if (storeAttempt && isUuid(sessionId)) {
    const session = await admin.from("practice_sessions").select("id, correct_count, incorrect_count, exercise_set_id")
      .eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (session.error) throw session.error;
    if (session.data) {
      let questionId: string | null = null;
      const candidateQuestionId = body["questionId"];
      if (isUuid(candidateQuestionId)) {
        const question = await admin.from("exercise_questions").select("id, vocabulary_id, exercise_set_id")
          .eq("id", candidateQuestionId).maybeSingle();
        if (question.error) throw question.error;
        if (question.data && question.data.vocabulary_id === deckItemId &&
          (!session.data.exercise_set_id || question.data.exercise_set_id === session.data.exercise_set_id)) {
          questionId = candidateQuestionId;
        }
      }
      await admin.from("question_attempts").insert({
        session_id: sessionId,
        question_id: questionId,
        deck_item_id: deckItemId,
        user_id: userId,
        submitted_answer: { value: body["submittedAnswer"] ?? "" },
        is_correct: isCorrect,
        response_time_ms: Number.isFinite(responseTimeMs) ? responseTimeMs : 0,
      });
      await admin.from("practice_sessions").update({
        correct_count: session.data.correct_count + (isCorrect ? 1 : 0),
        incorrect_count: session.data.incorrect_count + (isCorrect ? 0 : 1),
      }).eq("id", sessionId).eq("user_id", userId);
    }
  }
  return jsonResponse({ reviewState: review.data, isCorrect });
}

async function completePracticeSession(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  requestIdValue: string,
): Promise<Response> {
  const sessionId = String(body["sessionId"] ?? "");
  const correctCount = Math.max(0, Number(body["correctCount"] ?? 0));
  const totalQuestions = Math.max(0, Number(body["totalQuestions"] ?? 0));
  if (!isUuid(sessionId)) return errorResponse("INVALID_REQUEST", "A valid sessionId is required.", requestIdValue, 400);
  const result = await admin.from("practice_sessions").update({
    completed_at: new Date().toISOString(),
    correct_count: correctCount,
    incorrect_count: Math.max(0, totalQuestions - correctCount),
    score: totalQuestions ? correctCount / totalQuestions : 0,
  }).eq("id", sessionId).eq("user_id", userId);
  if (result.error) throw result.error;
  return jsonResponse({ completed: true });
}

async function getOwnedDeck(admin: SupabaseClient, userId: string, deckId: string): Promise<Record<string, unknown> | null> {
  const result = await admin.from("decks").select("id, name, source_language_id, target_language_id")
    .eq("id", deckId).eq("user_id", userId).eq("is_archived", false).maybeSingle();
  if (result.error) throw result.error;
  return result.data as Record<string, unknown> | null;
}

async function loadVocabulary(admin: SupabaseClient, deckId: string): Promise<VocabularyContext[]> {
  const result = await admin.from("deck_items").select(
    "id, custom_meaning, created_at, lexeme:lexemes(term, senses(definition, translations(translation), examples(sentence))), review_state:review_states(mastery, next_review_at)",
  ).eq("deck_id", deckId).limit(500);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as Array<Record<string, unknown>>;
  rows.sort((left, right) => {
    const leftState = asRecord(left.review_state);
    const rightState = asRecord(right.review_state);
    const leftDue = !leftState?.next_review_at || new Date(String(leftState.next_review_at)).getTime() <= Date.now() ? 0 : 1;
    const rightDue = !rightState?.next_review_at || new Date(String(rightState.next_review_at)).getTime() <= Date.now() ? 0 : 1;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return Number(leftState?.mastery ?? 0) - Number(rightState?.mastery ?? 0);
  });
  return rows.slice(0, 100).map(toVocabularyContext).filter((item): item is VocabularyContext => Boolean(item));
}

function toVocabularyContext(row: Record<string, unknown>): VocabularyContext | null {
  const lexeme = asRecord(row.lexeme);
  const id = typeof row.id === "string" ? row.id : "";
  const term = typeof lexeme?.term === "string" ? lexeme.term.trim() : "";
  if (!id || !term) return null;
  const senses = Array.isArray(lexeme?.senses) ? lexeme.senses : [];
  const meanings = unique(senses.flatMap((sense) => {
    const value = asRecord(sense);
    return [value?.definition, ...(Array.isArray(value?.translations) ? value.translations.map((translation) => asRecord(translation)?.translation) : [])];
  }).filter((value): value is string => typeof value === "string" && Boolean(value.trim())));
  const examples = unique(senses.flatMap((sense) => {
    const value = asRecord(sense);
    return Array.isArray(value?.examples) ? value.examples.map((example) => asRecord(example)?.sentence) : [];
  }).filter((value): value is string => typeof value === "string" && Boolean(value.trim())));
  if (typeof row.custom_meaning === "string" && row.custom_meaning.trim()) meanings.unshift(row.custom_meaning.trim());
  return { id, term, meanings: unique(meanings).slice(0, 8), translations: [], examples: examples.slice(0, 5) };
}

function toPracticeQuestion(value: unknown, vocabulary: VocabularyContext[], source: "gemini" | "deterministic"): Record<string, unknown> | null {
  const row = asRecord(value);
  if (!row) return null;
  const payload = asRecord(row.payload);
  const answer = asRecord(row.answer);
  const deckItemId = String(row.deckItemId ?? row.vocabulary_id ?? "");
  const context = vocabulary.find((item) => item.id === deckItemId);
  const vocabularyRow = asRecord(row.vocabulary);
  const storedLexeme = asRecord(vocabularyRow?.lexeme);
  const nestedPayload = asRecord(payload?.data);
  const choices = Array.isArray(payload?.choices) ? payload.choices.filter((item): item is string => typeof item === "string") : [];
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? "flashcard"),
    deckItemId,
    term: String(row.term ?? storedLexeme?.term ?? context?.term ?? ""),
    prompt: String(row.prompt ?? ""),
    answer: typeof row.answer === "string" ? row.answer : String(answer?.value ?? ""),
    choices,
    explanation: String(row.explanation ?? ""),
    acceptedAnswers: Array.isArray(answer?.acceptedAnswers) ? answer.acceptedAnswers.filter((item): item is string => typeof item === "string") : [],
    payload: nestedPayload ?? payload ?? {},
    source,
  };
}

function parseCount(value: unknown): number {
  return validateQuestionCount(value);
}

function parseModes(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new Error("INVALID_EXERCISE_MODES");
  const modes = value.map(String);
  if (modes.some((mode) => !isSupportedType(mode))) throw new Error("INVALID_EXERCISE_MODES");
  return [...new Set(modes)];
}

function parseDifficulty(value: unknown): ExerciseGenerationOptions["difficulty"] {
  return value === "easy" || value === "hard" ? value : "adaptive";
}

function boundedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" ? value as Record<string, any> : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function fallbackWarning(code: string): string {
  if (code === "GEMINI_NOT_CONFIGURED") return "Gemini chưa được cấu hình; đã dùng bài luyện tập nhanh.";
  if (code === "GEMINI_RATE_LIMITED") return "Gemini đang giới hạn tốc độ; đã dùng bài luyện tập nhanh.";
  if (code === "GEMINI_TIMEOUT") return "Gemini phản hồi quá lâu; đã dùng bài luyện tập nhanh.";
  return "Gemini không tạo được bộ câu hỏi hợp lệ; đã dùng bài luyện tập nhanh.";
}

function errorCode(message: string): string {
  if (message.startsWith("SUPABASE_CONFIG_MISSING")) return "SUPABASE_CONFIG_MISSING";
  if (message === "AUTH_REQUIRED") return "AUTH_REQUIRED";
  if (message === "INVALID_QUESTION_COUNT" || message === "INVALID_EXERCISE_MODES") return "INVALID_REQUEST";
  if (message.includes("DECK_NOT_FOUND")) return "DECK_NOT_FOUND";
  if (message.includes("VOCABULARY_NOT_FOUND")) return "VOCABULARY_NOT_FOUND";
  if (message.includes("EXERCISE_SET_NOT_FOUND")) return "EXERCISE_SET_NOT_FOUND";
  if (message.includes("AI_QUOTA")) return "AI_QUOTA_EXCEEDED";
  return "LEARNING_OPERATION_FAILED";
}

function publicErrorMessage(code: string, message: string): string {
  if (code === "INVALID_REQUEST") return "Invalid learning request.";
  if (code === "AI_QUOTA_EXCEEDED") return message;
  if (code === "SUPABASE_CONFIG_MISSING") return message;
  if (code === "AUTH_REQUIRED") return "Authentication is required.";
  return message;
}

function errorStatus(code: string): number {
  if (code === "AUTH_REQUIRED") return 401;
  if (code === "SUPABASE_CONFIG_MISSING") return 500;
  if (code === "AI_QUOTA_EXCEEDED") return 429;
  if (code.endsWith("NOT_FOUND")) return 404;
  return code === "INVALID_REQUEST" ? 400 : 400;
}
