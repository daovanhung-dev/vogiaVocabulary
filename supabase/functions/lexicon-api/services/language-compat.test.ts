import {
  LexiconRequestError,
  validateDeckLanguage,
  validateTermLanguage,
} from "./language-compat.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("rejects Japanese text for an English deck", () => {
  try {
    validateTermLanguage("こんにちは", "en", "vi");
    throw new Error("Expected LANGUAGE_MISMATCH");
  } catch (error) {
    assert(error instanceof LexiconRequestError, "Expected request error");
    assert(
      error.code === "LANGUAGE_MISMATCH",
      "Expected language mismatch code",
    );
    assert(error.status === 422, "Expected validation status");
  }
});

Deno.test("accepts Japanese text for a Japanese deck", () => {
  validateTermLanguage("こんにちは", "ja", "vi");
});

Deno.test("requires imported item language to match its deck", () => {
  try {
    validateDeckLanguage("ja", "en", "source language");
    throw new Error("Expected LANGUAGE_MISMATCH");
  } catch (error) {
    assert(error instanceof LexiconRequestError, "Expected request error");
    assert(
      error.code === "LANGUAGE_MISMATCH",
      "Expected language mismatch code",
    );
  }
});
