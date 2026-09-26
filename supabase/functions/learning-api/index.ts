import { authenticatedUser } from "../_shared/auth.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  readBody,
  requestId,
} from "../_shared/http.ts";

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

    if (route === "sessions") {
      const deckId = String(body["deckId"] ?? "");
      const ownership = await admin.from("decks").select("id").eq("id", deckId)
        .eq("user_id", user.id).eq("is_archived", false).maybeSingle();
      if (!ownership.data) {
        return errorResponse(
          "DECK_NOT_FOUND",
          "The requested deck was not found.",
          id,
          404,
        );
      }
      const { data, error } = await admin.from("practice_sessions").insert({
        user_id: user.id,
        deck_id: deckId,
      }).select("id").single();
      if (error) throw error;
      return jsonResponse({ sessionId: data.id });
    }

    if (route === "attempts" || route === "review") {
      const deckItemId = String(body["deckItemId"] ?? "");
      const isCorrect = Boolean(body["isCorrect"]);
      const responseTimeMs = Number(body["responseTimeMs"] ?? 0);
      if (!deckItemId) {
        return errorResponse(
          "INVALID_REQUEST",
          "deckItemId is required.",
          id,
          400,
        );
      }

      const review = await admin.rpc("record_review", {
        p_user_id: user.id,
        p_deck_item_id: deckItemId,
        p_is_correct: isCorrect,
        p_response_time_ms: Number.isFinite(responseTimeMs)
          ? responseTimeMs
          : 0,
      });
      if (review.error) throw review.error;

      const sessionId = String(body["sessionId"] ?? "");
      if (route === "attempts" && isUuid(sessionId)) {
        const ownership = await admin.from("practice_sessions").select(
          "id, correct_count, incorrect_count",
        ).eq("id", sessionId).eq("user_id", user.id).maybeSingle();
        if (ownership.data) {
          await admin.from("question_attempts").insert({
            session_id: sessionId,
            question_id: isUuid(body["questionId"]) ? body["questionId"] : null,
            deck_item_id: deckItemId,
            user_id: user.id,
            submitted_answer: { value: body["submittedAnswer"] ?? "" },
            is_correct: isCorrect,
            response_time_ms: responseTimeMs,
          });
          await admin.from("practice_sessions").update({
            correct_count: ownership.data.correct_count + (isCorrect ? 1 : 0),
            incorrect_count: ownership.data.incorrect_count +
              (isCorrect ? 0 : 1),
          }).eq("id", sessionId).eq("user_id", user.id);
        }
      }
      return jsonResponse({ reviewState: review.data, isCorrect });
    }

    if (route === "complete") {
      const sessionId = String(body["sessionId"] ?? "");
      const correctCount = Number(body["correctCount"] ?? 0);
      const totalQuestions = Number(body["totalQuestions"] ?? 0);
      if (!isUuid(sessionId)) {
        return errorResponse(
          "INVALID_REQUEST",
          "A valid sessionId is required.",
          id,
          400,
        );
      }
      const { error } = await admin.from("practice_sessions").update({
        completed_at: new Date().toISOString(),
        correct_count: correctCount,
        incorrect_count: Math.max(0, totalQuestions - correctCount),
        score: totalQuestions ? correctCount / totalQuestions : 0,
      }).eq("id", sessionId).eq("user_id", user.id);
      if (error) throw error;
      return jsonResponse({ completed: true });
    }

    return errorResponse(
      "INVALID_REQUEST",
      `Unknown learning route: ${route}`,
      id,
      400,
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Learning request failed.";
    const code = message.startsWith("SUPABASE_CONFIG_MISSING")
      ? "SUPABASE_CONFIG_MISSING"
      : message === "AUTH_REQUIRED"
      ? "AUTH_REQUIRED"
      : message.includes("DECK_NOT_FOUND")
      ? "DECK_NOT_FOUND"
      : message.includes("VOCABULARY_NOT_FOUND")
      ? "VOCABULARY_NOT_FOUND"
      : "LEARNING_OPERATION_FAILED";
    return errorResponse(
      code,
      message,
      id,
      code === "AUTH_REQUIRED"
        ? 401
        : code === "SUPABASE_CONFIG_MISSING"
        ? 500
        : code.endsWith("NOT_FOUND")
        ? 404
        : 400,
    );
  }
});
