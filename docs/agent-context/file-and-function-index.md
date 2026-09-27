# Danh mục file và function

Mục đích là giúp agent xác định nơi sửa và luồng liên quan. Mô tả bám theo snapshot `b12e8a5`; mở code lại trước khi sửa nếu repository đã thay đổi.

## Root, docs, CI và cấu hình

| File | Mục đích |
|---|---|
| `AGENTS.md` | Chỉ dẫn ngắn bắt buộc cho agent, lệnh và ranh giới bảo mật |
| `README.md` | Setup, secrets, Supabase/GitHub Pages deploy, routes và test commands |
| `bd.md` | Blueprint/roadmap; có nhiều thành phần chưa tồn tại trong runtime |
| `.gitignore` | Bỏ qua dependencies, build/cache, env local, Supabase local metadata |
| `.env.example` | Mẫu URL/publishable key public |
| `package.json` | Scripts/dependencies Angular, Supabase JS, Fuse, RxJS, Vitest |
| `package-lock.json` | Khóa phiên bản dependency để cài tái lập; không phải source runtime |
| `angular.json` | Angular build/serve, assets/styles, budgets production |
| `tsconfig.json`, `tsconfig.app.json` | TypeScript strict và cấu hình compile Angular |
| `vitest.config.ts` | Vitest Node, include `tests/**/*.spec.ts` |
| `.github/workflows/deploy-pages.yml` | CI build, inject public config, kiểm tra secret marker, deploy Pages |
| `scripts/write-github-environment.mjs` | Kiểm tra env URL/key và sinh `src/environments/environment.ts` trong CI |
| `docs/bugs/2026-09-26-web-test.md` | Báo cáo web test cũ; gồm lỗi đã được fix/retest và trạng thái lúc ghi |
| `docs/bugs/2026-09-26-ui-regression.md` | Báo cáo UI test 2026-09-27, sáu issue mở; vốn là file untracked lúc khảo sát |
| `docs/agent-context/README.md` | Mục lục, nguồn sự thật và quy tắc cập nhật context |
| `docs/agent-context/architecture.md` | Kiến trúc, module, luồng và triển khai |
| `docs/agent-context/contracts.md` | Type/API/database/RPC/security contracts |
| `docs/agent-context/file-and-function-index.md` | File/function index này |
| `docs/agent-context/known-issues.md` | Known issues và bằng chứng kiểm tra |

## Angular bootstrap, core và shell

| File | Thành phần/hàm | Ý nghĩa |
|---|---|---|
| `src/main.ts` | `bootstrapApplication(...)` | Khởi chạy root component với `appConfig`; log lỗi bootstrap |
| `src/app/app.component.ts` | `AppComponent` | Root standalone component chỉ render router outlet |
| `src/app/app.config.ts` | `appConfig` | Cấu hình zone, animations, hash router, initializer anonymous session |
| `src/app/app.routes.ts` | `routes` | Khai báo shell/dashboard/decks/detail/add/vocabulary/practice và wildcard redirect |
| `src/app/core/config/app-config.ts` | `isSupabaseConfigured()` | Kiểm tra URL HTTPS và key đã thay placeholder |
|  | `requireSupabaseConfiguration()` | Ném hướng dẫn setup nếu Supabase chưa cấu hình |
| `src/app/core/supabase/supabase.service.ts` | `SupabaseService.client` | Tạo Supabase client persistent nếu cấu hình hợp lệ |
|  | `requiredClient` | Trả client hoặc ném setup error |
| `src/app/core/auth/anonymous-session.service.ts` | `initialize()` | Idempotent initializer; lưu lỗi user-facing và đánh dấu ready |
|  | `ensureSession()` | Bỏ qua nếu chưa cấu hình, tái sử dụng session hoặc anonymous sign-in |
|  | `toUserMessage()` | Map lỗi anonymous sign-in sang hướng dẫn tiếng Việt |
| `src/app/layout/app-shell.component.ts` | `AppShellComponent.initials` | Trả avatar initials hiện tại là `L`; template render nav/setup banners |
| `src/index.html` | HTML shell | Base document, title, viewport và `<gv-root>` |
| `src/styles.css` | Global styles | Angular Material theme, design tokens, layout primitives và responsive grid |
| `src/environments/environment.ts` | `environment` | Cấu hình public local hiện là placeholder, không chứa backend secret |
| `src/environments/environment.example.ts` | `environment` mẫu | Mẫu cấu hình public để setup |
| `src/assets/.gitkeep` | — | Giữ thư mục assets rỗng trong Git |

## Shared model, component và utility

| File | Thành phần/hàm | Ý nghĩa |
|---|---|---|
| `src/app/shared/models/domain.models.ts` | `Language`, `Profile`, `Deck`, `Lexeme`, `Sense`, `Translation`, `Example`, `DeckItem`, `ReviewState` | Database/domain models dùng bởi frontend |
|  | `DashboardStats`, `LexiconSearchRequest`, `LexiconTranslation`, `LexiconExample`, `LexiconSense`, `LexiconSearchResult`, `ImportResult` | Hợp đồng thống kê, lexicon và import |
|  | `ExerciseType`, `ExerciseDifficulty`, `ExerciseDirection`, `ExerciseSource`, `ExerciseGenerationRequest`, `ExerciseGenerationResponse`, `PracticeQuestion`, `ReviewResponse` | Hợp đồng practice/generation |
| `src/app/shared/utils/normalize.ts` | `normalizeTerm()` | NFKC, trim, gộp whitespace, locale lowercase |
|  | `parseBatchInput()` | Tách newline/comma/semicolon, normalize và loại trùng |
| `src/app/shared/utils/language-validation.ts` | `differentLanguagesValidator` | Cross-field validator chặn source/target language giống nhau |
| `src/app/shared/utils/language-compat.ts` | `detectLikelyLanguage()` | Nhận diện Japanese kana và Korean Hangul |
|  | `languageMismatchMessage()` | Tạo cảnh báo query không khớp language source |
|  | `hasImportableDefinition()` | Kiểm tra có sense definition không rỗng |
| `src/app/shared/utils/dictionary.ts` | `DictionaryViewTranslation`, `DictionaryViewExample`, `DictionaryViewSense`, `DictionaryViewEntry` | View model dictionary trung gian |
|  | `fromLexiconResult()` | Map kết quả API camelCase sang view model |
|  | `fromDeckItem()` | Map Supabase nested snake_case row sang view model |
|  | `firstDictionaryMeaning()` | Chọn custom meaning, translation, definition hoặc placeholder |
| `src/app/shared/utils/learning.ts` | `LearningUpdateInput`, `LearningUpdate` | Input/output pure helper cho review algorithm |
|  | `calculateLearningUpdate()` | Tính mastery/stability/streak/next review ở client; persistence hiện do DB RPC |
| `src/app/shared/utils/review-streak.ts` | `dateKey()` | Chuyển timestamp thành ngày theo timezone |
|  | `shiftDateKey()` | Lùi ngày bằng UTC calendar arithmetic |
|  | `calculateReviewStreakDays()` | Đếm chuỗi ngày review liên tiếp đến hôm nay hoặc hôm qua |
| `src/app/shared/components/dictionary-details.component.ts` | `DictionaryDetailsComponent` | Render IPA, romanization, audio, source, meanings, translations/examples |

## Angular features

| File | Thành phần/hàm | Ý nghĩa |
|---|---|---|
| `src/app/features/decks/deck.service.ts` | `DeckService.loadLanguages()` | Đọc language enabled; dùng preset khi preview offline |
|  | `listDecks()`, `getDeck()` | Lấy deck active/specific và gắn language metadata |
|  | `createDeck()`, `updateDeck()`, `archiveDeck()` | Tạo, sửa, archive deck |
|  | `removeDeckItem()`, `listDeckItems()` | Xóa item hoặc đọc vocabulary kèm lexicon/review state |
|  | `getDashboardStats()` | Đếm deck items và tính review streak từ attempts |
| `src/app/features/decks/decks.component.ts` | `DecksComponent.ngOnInit()` | Load language, set default pair, load decks |
|  | `refresh()` | Tải lại active decks và trạng thái loading |
|  | `createDeck()` | Submit form để create hoặc update deck |
|  | `startEdit()`, `cancelEdit()` | Đi vào/thoát chế độ sửa form |
|  | `archiveDeck()` | Confirm rồi archive deck và refresh |
|  | `languageName()` | Resolve tên language ID |
| `src/app/features/decks/deck-detail.component.ts` | `DeckDetailComponent.ngOnInit()` | Đọc route snapshot, load deck và items |
|  | `masteredCount`, `dueCount` | Tính local progress counts |
|  | `firstMeaning()`, `masteryLabel()` | Format meaning/progress cho preview |
| `src/app/features/dashboard/dashboard.component.ts` | `DashboardComponent.ngOnInit()` | Load languages, decks, stats và error state |
|  | `languageName()` | Resolve tên source/target language |
| `src/app/features/search/search.service.ts` | `SearchService.search()` | Invoke search route, normalize response và Fuse rank |
|  | `searchBatch()` | Invoke batch route và map response theo query |
|  | `importSelected()` | Invoke import route và trả import counters |
|  | `localRank()` | Xếp exact matches trước fuzzy Fuse results, dedupe theo normalized term |
| `src/app/features/search/function-error.ts` | `toLexiconError()` | Chuyển function/auth/network/provider errors thành thông báo phù hợp |
|  | `readFunctionPayload()` | Parse structured error body từ `Response` an toàn |
| `src/app/features/search/add-vocabulary.component.ts` | `AddVocabularyComponent.ngOnInit()` | Load deck, thiết lập debounce/distinct/switchMap search stream |
|  | `runBatch()` | Normalize/validate batch, gọi API và gộp results |
|  | `toggle()`, `isSelected()` | Chọn/bỏ chọn candidate theo normalized term |
|  | `isExpanded()`, `toggleDetails()` | Quản lý expanded dictionary details |
|  | `dictionaryEntry()`, `canImport()`, `meaning()` | Map candidate và tính import eligibility/display meaning |
|  | `importSelected()` | Gửi candidate đã chọn rồi điều hướng về vocabulary list |
|  | getters `selectedCount`, `sourceLanguageName`, `targetLanguageName`, `sourceCode`, `targetCode` | Tính state/template metadata |
| `src/app/features/vocabulary/vocabulary.component.ts` | `VocabularyFilter` | Union `all/new/learning/mastered/weak/due` |
|  | `filteredItems` | Áp dụng search text và mastery/due filter |
|  | `VocabularyComponent.ngOnInit()` | Tải items theo route snapshot deck ID |
|  | `remove()` | Confirm, xóa item và cập nhật local signals |
|  | `isExpanded()`, `toggleDetails()`, `dictionaryEntry()`, `meaning()` | Details display state và mapping |
|  | `searchableText()`, `progress()`, `progressLabel()` | Tạo search hay format progress |
| `src/app/features/practice/practice.service.ts` | `buildQuestions()` | Sinh quick deterministic questions từ items có meaning và ưu tiên mastery thấp |
|  | `hasMeaning()` | Kiểm tra practice readiness |
|  | `isCorrect()` | So sánh normalized answer với answer/accepted answers |
|  | `generateSet()`, `loadSet()` | Invoke learning API generation/get-set |
|  | `createSession()`, `recordAttempt()`, `completeSession()` | Tạo session, ghi answer/review, hoàn tất session |
|  | `meaning()`, `shuffle()` | Helpers lấy meaning và trộn choices |
| `src/app/features/practice/practice.component.ts` | `MODE_OPTIONS`, `ModeOption`, `MatchingPair` | Metadata UI cho exercise mode và matching pair |
|  | `PracticeComponent.ngOnInit()` | Load deck/items và optionally load set từ query param |
|  | `generateAiPractice()` | Validate count/readiness, gọi generation, khởi chạy set |
|  | `startQuickPractice()` | Tạo quick deterministic session |
|  | `hasUsableVocabulary()` | Kiểm tra ít nhất một item có meaning |
|  | `toggleMode()`, `isModeSelected()`, `clearModes()` | Thay đổi game mix |
|  | `submitAnswer()` | Chấm câu hiện tại, tăng score và cố gắng persist attempt |
|  | `next()`, `resetSetup()` | Chuyển câu/hoàn tất hoặc reset setup |
|  | `isChoiceQuestion()`, `questionChoices()`, `matchingPairs()`, `formatType()` | Điều chỉnh dữ liệu cho renderer câu hỏi |
|  | `startGeneratedPractice()`, `startSession()` | Áp dụng generation result và mở session |
|  | `toMessage()` | Chọn message từ exception hoặc fallback |
|  | getters `deckId`, `currentQuestion`, `progress`, `score` | Route/session-derived UI values |

## Supabase schema và Edge Functions

| File | Thành phần/hàm | Ý nghĩa |
|---|---|---|
| `infra/supabase.sql` | Schema, seed, trigger, RPC, RLS/grants | Canonical SQL để setup thủ công; xem contracts để biết bảng/RPC |
| `supabase/migrations/20260926000000_initial_schema.sql` | Migration tương đương | Dùng `supabase db push`; cập nhật cùng `infra/supabase.sql` khi schema đổi |
| `supabase/config.toml` | Local project/auth/functions config | Anonymous auth bật; hai function verify JWT ở gateway tắt vì code tự xác thực |
| `supabase/functions/.env.example` | Local Edge Function env template | Supabase URL/keys và Gemini env; không chứa credential thật |
| `supabase/functions/_shared/auth.ts` | `environmentValues()` | Đọc key environment được hỗ trợ |
|  | `requiredSupabaseUrl()` | Lấy URL bắt buộc |
|  | `adminClient()` | Tạo service/admin Supabase client từ secret key |
|  | `authenticatedUser()` | Verify bearer user JWT bằng publishable key, trả user + admin client |
| `supabase/functions/_shared/http.ts` | `corsHeaders`, `jsonResponse()`, `errorResponse()`, `requestId()`, `readBody()` | CORS, JSON/error envelope, request ID và parse JSON body |
| `supabase/functions/_shared/supabase-keys.ts` | `SupabaseEnvironmentValues`, `ResolvedSupabaseKeys` | Kiểu key config |
|  | `readDefaultKey()`, `readValue()` | Parse JSON key map hoặc trim legacy value |
|  | `resolveSupabaseKeys()` | Chọn publishable/secret key theo hosted map rồi legacy fallback |
| `supabase/functions/lexicon-api/providers/provider.interface.ts` | `LexiconSearchRequest`, `ProviderSense`, `LexiconSearchResult`, `LexiconProvider` | Provider contract và normalized result types |
| `supabase/functions/lexicon-api/services/normalize.ts` | `normalizeTerm()` | Server copy của Unicode/whitespace/case normalization |
| `supabase/functions/lexicon-api/services/language-compat.ts` | `LexiconRequestError` | Error có code và HTTP status |
|  | `normalizeLanguageCode()` | Chuẩn hóa/validate language subtag |
|  | `detectLikelyLanguage()` | Nhận diện Japanese kana/Korean Hangul |
|  | `validateTermLanguage()` | Ném `LANGUAGE_MISMATCH` nếu script mâu thuẫn source |
|  | `validateDeckLanguage()` | Bắt item source/target không khớp deck |
| `supabase/functions/lexicon-api/index.ts` | `Deno.serve()` router | Auth, route selection, dispatch, structured error mapping |
|  | `searchWithCache()` | Cache/provider lookup dùng bởi batch |
|  | `getImportDetails()` | Lấy details và map 404/501 thành `DETAILS_UNAVAILABLE` |
|  | `hasUsableCachedSearch()` | Bỏ cache rỗng hoặc candidate không có definition |
| `supabase/functions/lexicon-api/providers/wiktionary.provider.ts` | Response interfaces/types | Mô hình search, legacy/current definition, pronunciation, parse/wikitext metadata |
|  | `WiktionaryProvider.search()` | Exact lookup, MediaWiki search, exact-first ordering, lấy detail cho candidates |
|  | `getDetails()` | REST definitions; Japanese 404/501 fallback; enrich metadata và build senses |
|  | `fetchJapaneseWikitext()` | Gọi MediaWiki parse API tiếng Nhật |
|  | `tryFetchWikitextMetadata()`, `fetchWikitext()` | Best-effort metadata lookup |
|  | `fromWikitext()` | Parse definition/examples trong language section đúng |
|  | `emptyResult()`, `languageCode()`, `fetchJson()` | Empty candidate, language host validation, HTTP retry/timeout |
|  | `pushSense()`, `buildSense()`, `withTranslations()` | Làm sạch/build senses và target translation |
|  | `extractRestMetadata()`, `mergeMetadata()`, `parseWikitextMetadata()` | Hợp nhất REST/wikitext metadata |
|  | `parseIpa()`, `parseAudio()`, `parseTranslations()` | Đọc IPA, audio, translation template |
|  | `readHeading()`, `readSubHeading()`, `isLanguageHeading()`, `isNonDefinitionSection()`, `parsePartOfSpeech()` | Helpers cho cấu trúc section wikitext |
|  | `normalizeAudioUrl()`, `cleanMetadataValue()`, `uniqueNonEmpty()`, `escapeRegExp()` | Chuẩn hóa value và loại duplicate |
|  | `kanaToRomaji()` | Chuyển kana sang romaji cho metadata Japanese |
|  | `isDefinitionFallbackError()`, `isParseResponse()`, `stripWikiText()` | Phân loại fallback, narrowing response và làm sạch markup |
| `supabase/functions/learning-api/exercises.ts` | `SUPPORTED_EXERCISE_TYPES`, `VocabularyContext`, `ExerciseGenerationOptions`, `GeneratedQuestionDraft` | Contract generation phía Deno |
|  | `GeminiExerciseProvider.generate()` | Gọi Gemini JSON generation với timeout/schema |
|  | `validateGeneratedQuestions()` | Schema/semantic validation câu hỏi và vocabulary references |
|  | `validateQuestionCount()` | Ràng buộc 10–100 câu |
|  | `buildDeterministicQuestions()` | Tạo fallback không phụ thuộc Gemini |
|  | `isSupportedType()`, `isChoiceType()` | Kiểm tra exercise type |
|  | `buildPrompt()`, `promptFor()` | Tạo prompt và prompt template deterministic |
|  | `stringValue()`, `boundedString()`, `stringArray()`, `uniqueStrings()`, `clampInteger()`, `hasPairs()`, `shuffle()` | Input validators/normalizers/helpers |
| `supabase/functions/learning-api/index.ts` | `isUuid()` | Validate UUID inputs |
|  | `Deno.serve()` router | Auth, dispatch route, convert exception sang public error |
|  | `generateExerciseSet()` | Ownership, vocabulary load, quota, Gemini/fallback, RPC persistence, response mapping |
|  | `getExerciseSet()` | Fetch owned exercise set và questions |
|  | `createPracticeSession()` | Validate deck/set ownership và insert session |
|  | `recordAttempt()` | Persist review; optionally attempt/counters for valid session/question |
|  | `completePracticeSession()` | Ghi completion/score/counters |
|  | `getOwnedDeck()` | Select active deck theo user |
|  | `loadVocabulary()`, `toVocabularyContext()` | Lọc/sort/build AI context từ nested Supabase rows |
|  | `toPracticeQuestion()` | Map stored/RPC question JSON sang response question |
|  | `parseCount()`, `parseModes()`, `parseDifficulty()`, `boundedText()` | Parse/validate generation request |
|  | `asRecord()`, `unique()` | JSON object narrowing và dedupe |
|  | `fallbackWarning()` | User warning theo nhóm lỗi Gemini |
|  | `errorCode()`, `publicErrorMessage()`, `errorStatus()` | Map backend errors thành envelope/status |

## Tests và test files

| File | Phạm vi kiểm tra |
|---|---|
| `tests/anonymous-session.spec.ts` | Tái sử dụng session, anonymous sign-in, thông báo disabled provider |
| `tests/dictionary.spec.ts` | Mapping search/deck item metadata sang dictionary view |
| `tests/exercises.spec.ts` | Question count, invalid references, deterministic fallback, Gemini JSON/quota/timeout |
| `tests/function-error.spec.ts` | Missing function, auth, network, structured language/details/provider errors |
| `tests/language-compat.spec.ts` | Japanese mismatch, accepted source script, importable definition |
| `tests/language-validation.spec.ts` | Same-language validator và incomplete values |
| `tests/learning.spec.ts` | Mastery/stability/review date update pure helper |
| `tests/normalize.spec.ts` | Unicode normalization, scripts, batch parse/dedupe |
| `tests/practice.service.spec.ts` | Meaning readiness và quick question generation |
| `tests/review-streak.spec.ts` | Consecutive dates, expiry, timezone grouping |
| `tests/supabase-keys.spec.ts` | Hosted key maps và legacy fallbacks |
| `supabase/functions/lexicon-api/providers/wiktionary.provider.test.ts` | REST schema mới/cũ, clean markup, metadata, Japanese fallback/romaji |
| `supabase/functions/lexicon-api/services/language-compat.test.ts` | Backend script mismatch và deck-language validation |

## Không nằm trong runtime/inventory nội hàm

`node_modules/`, `dist/`, `.angular/`, `supabase/.temp/` gồm dependencies, bundles, cache hoặc Supabase CLI metadata local. Không lập index từng file ở đó. `src/app/features/auth/` hiện là thư mục rỗng; không có auth UI riêng. Blueprint có nhắc `ai-api`, provider Gemini cho lexicon, Storage/Realtime, jobs, audit, settings/progress/flashcards modules và nhiều provider; các phần này chưa có source runtime tương ứng trong snapshot.
