import { WiktionaryProvider } from "./wiktionary.provider.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("parses current Wiktionary definitions and cleans markup", async () => {
  const provider = new WiktionaryProvider(async () =>
    new Response(
      JSON.stringify({
        en: [{
          partOfSpeech: "Noun",
          definitions: [{
            definition: "A <b>small</b> fruit &amp; snack.",
            parsedExamples: [{ example: "Eat an <b>apple</b>." }],
          }, { definition: "" }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );

  const result = await provider.getDetails({
    query: "apple",
    term: "apple",
    sourceLanguage: "en",
    targetLanguage: "vi",
  });
  assert(result.senses.length === 1, "Expected one non-empty sense");
  assert(
    result.senses[0].definition === "A small fruit & snack.",
    "Expected cleaned definition",
  );
  assert(
    result.senses[0].examples[0].sentence === "Eat an apple.",
    "Expected cleaned example",
  );
});

Deno.test("keeps compatibility with the legacy senses/glosses schema", async () => {
  const provider = new WiktionaryProvider(async () =>
    new Response(
      JSON.stringify({
        en: [{
          partOfSpeech: "Verb",
          senses: [{
            glosses: ["to <i>run</i>"],
            examples: [{ text: "They run." }],
          }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  );

  const result = await provider.getDetails({
    query: "run",
    term: "run",
    sourceLanguage: "en",
    targetLanguage: "vi",
  });
  assert(result.senses.length === 1, "Expected legacy sense");
  assert(
    result.senses[0].definition === "to run",
    "Expected legacy definition",
  );
});

Deno.test("falls back to Japanese wikitext when REST definitions are unavailable", async () => {
  let callCount = 0;
  const provider = new WiktionaryProvider(async () => {
    callCount += 1;
    if (callCount === 1) return new Response('{"status":501}', { status: 501 });
    return new Response(
      JSON.stringify({
        parse: {
          wikitext: {
            "*": [
              "=={{L|ja}}==",
              "==={{interjection|ja}}===",
              "#{{context|greeting|lang=ja}}（特に日中に）人に会った時の[[挨拶]]の言葉",
              "=== {{noun}} ===",
              "# 「こんにちは」という挨拶。",
              "=={{L|en}}==",
              "# An unrelated English definition.",
            ].join("\n"),
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  const result = await provider.getDetails({
    query: "こんにちは",
    term: "こんにちは",
    sourceLanguage: "ja",
    targetLanguage: "vi",
  });
  assert(
    callCount === 2,
    "Expected REST request followed by wikitext fallback",
  );
  assert(result.senses.length === 2, "Expected two Japanese senses");
  assert(
    result.senses[0].definition.includes("挨拶"),
    "Expected cleaned Japanese definition",
  );
  assert(
    !result.senses.some((sense) => sense.definition.includes("unrelated")),
    "Should ignore other language sections",
  );
});
