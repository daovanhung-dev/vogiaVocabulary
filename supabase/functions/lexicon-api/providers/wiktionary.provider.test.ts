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
  assert(
    result.senses[0].translations.length === 0,
    "Should not invent a target-language translation from the source definition",
  );
});

Deno.test("enriches REST definitions with IPA, audio and target translations", async () => {
  let callCount = 0;
  const provider = new WiktionaryProvider(async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response(JSON.stringify({
        en: [{
          partOfSpeech: "Noun",
          definitions: [{ definition: "A small fruit." }],
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      parse: {
        wikitext: {
          "*": [
            "==English==",
            "===Pronunciation===",
            "* {{IPA|en|/ˈæpəl/|a=US}}",
            "* {{audio|en|En-us-apple.ogg|a=US}}",
            "====Translations====",
            "{{trans-top|fruit}}",
            "* Vietnamese: {{t|vi|quả táo}}",
            "{{trans-bottom}}",
          ].join("\n"),
        },
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  const result = await provider.getDetails({
    query: "apple",
    term: "apple",
    sourceLanguage: "en",
    targetLanguage: "vi",
  });
  assert(callCount === 2, "Expected REST and wikitext metadata requests");
  assert(result.phonetic === "/ˈæpəl/", "Expected IPA pronunciation");
  assert(result.audioUrl?.includes("En-us-apple.ogg") === true, "Expected Wikimedia audio URL");
  assert(result.senses[0].translations[0].translation === "quả táo", "Expected Vietnamese translation");
});

Deno.test("keeps compatibility with the legacy senses/glosses schema", async () => {
  const provider = new WiktionaryProvider(async () =>
    new Response(
      JSON.stringify({
        en: [{
          partOfSpeech: "Verb",
          senses: [{
            glosses: ["to <i>run</i>", "to move quickly"],
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
  assert(result.senses.length === 2, "Expected all legacy glosses");
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
  assert(result.senses[0].partOfSpeech === "interjection", "Expected Japanese part of speech");
  assert(
    !result.senses.some((sense) => sense.definition.includes("unrelated")),
    "Should ignore other language sections",
  );
});

Deno.test("extracts Japanese romanization from ja-pron", async () => {
  const provider = new WiktionaryProvider(async () => {
    return new Response(JSON.stringify({
      parse: {
        wikitext: {
          "*": [
            "=={{L|ja}}==",
            "==={{pron}}===",
            "{{ja-pron|こんにちは}}",
            "==={{interjection|ja}}===",
            "# A greeting.",
            "#: こんにちは、元気ですか。",
          ].join("\n"),
        },
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  const result = await provider.getDetails({
    query: "こんにちは",
    term: "こんにちは",
    sourceLanguage: "ja",
    targetLanguage: "vi",
  });
  assert(result.romanization === "konnichiha", "Expected romaji from ja-pron");
  assert(result.senses[0].examples[0].sentence.includes("元気"), "Expected Japanese example");
});
