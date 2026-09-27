# Hợp đồng dữ liệu, API và bảo mật

## Domain model Angular

Định nghĩa canonical phía frontend ở `src/app/shared/models/domain.models.ts`.

| Nhóm | Kiểu | Ý nghĩa |
|---|---|---|
| Ngôn ngữ/user | `Language`, `Profile` | Language metadata (code, BCP-47, script, direction, enabled); profile gắn auth user |
| Deck/vocabulary | `Deck`, `Lexeme`, `Sense`, `Translation`, `Example`, `DeckItem` | Deck sở hữu bởi user; lexical entry có nhiều sense/translation/example; deck item tham chiếu lexeme và có custom meaning/note |
| Tiến độ | `ReviewState`, `DashboardStats`, `ReviewResponse` | Mastery, stability, streak, counters, lịch review và dashboard aggregates |
| Lexicon API | `LexiconSearchRequest`, `LexiconTranslation`, `LexiconExample`, `LexiconSense`, `LexiconSearchResult`, `ImportResult` | Request search, kết quả normalized camelCase và thống kê import |
| Bài tập | `ExerciseType`, `ExerciseDifficulty`, `ExerciseDirection`, `ExerciseSource`, `ExerciseGenerationRequest`, `ExerciseGenerationResponse`, `PracticeQuestion` | Cấu hình generation, nguồn, câu hỏi, answer/choices/payload và warning |

Database row types dùng snake_case; payload Edge Function dùng camelCase trừ response questions khi map từ RPC. `toPracticeQuestion()` là adapter ở learning API giữa hai dạng đó. Provider contract của lexicon nằm riêng trong `supabase/functions/lexicon-api/providers/provider.interface.ts`.

## `lexicon-api`

Client gọi Supabase Function `lexicon-api` bằng body JSON có trường `route`. Handler xác thực bearer token trước khi xử lý route.

| Route | Input chính | Hành vi/response |
|---|---|---|
| `search` | `query`, `sourceLanguage`, `targetLanguage` | `{ results: LexiconSearchResult[] }`; cache + Wiktionary; query rỗng trả `INVALID_REQUEST` |
| `details` | `query` hoặc `term`, `sourceLanguage`, `targetLanguage` | Một `LexiconSearchResult`; lấy details trực tiếp |
| `search-batch` | `queries: string[]`, `sourceLanguage`, `targetLanguage` | `{ results: Record<string, LexiconSearchResult[]> }`; tối đa 100 query, tuần tự qua cache/provider |
| `import` | `deckId`, `items: LexiconSearchResult[]` | `{ inserted, duplicate, failed }`; tối đa 100 candidate và cần deck active thuộc user |

Các mã lỗi đáng chú ý: `AUTH_REQUIRED` (401), `SUPABASE_CONFIG_MISSING` (500), `INVALID_REQUEST` (400), `INVALID_LANGUAGE`, `LANGUAGE_MISMATCH` (422), `DECK_NOT_FOUND` (404), `DETAILS_UNAVAILABLE` (422), `LEXICON_PROVIDER_TIMEOUT`/`LEXICON_PROVIDER_FAILED` (502). Error envelope: `{ error: { code, message, requestId } }`.

Ngôn ngữ truyền vào được chuẩn hóa dạng language subtag 2–3 chữ cái; các region suffix như `en-US` bị bỏ khi xác định Wiktionary host. Detector hiện nhận diện Hiragana/Katakana là Japanese và Hangul là Korean; đây không phải language identification tổng quát. Import luôn đối chiếu source/target của item với language ID của deck và validate script của term.

Cache key gồm query normalized, source language, target language và provider `wiktionary-v5`; TTL là 7 ngày. Cache rỗng hoặc không có definition không được xem là usable.

## `learning-api`

| Route | Input chính | Hành vi/response |
|---|---|---|
| `generate-set` | `deckId` UUID, `count` 10–100, `modes[]`, `difficulty`, `direction`, `title?` | Sinh bằng Gemini; validate; fallback deterministic; lưu set/questions; response gồm `exerciseSetId`, `source`, `model`, `count`, `questions`, `warning?` |
| `get-set` | `exerciseSetId` UUID | Lấy set thuộc user và question records |
| `sessions` | `deckId`, `questionCount`, `exerciseSetId?` | Tạo practice session, trả `{ sessionId }` |
| `attempts` | `sessionId?`, `deckItemId`, `questionId?`, `submittedAnswer`, `isCorrect`, `responseTimeMs` | Cập nhật review state; nếu session hợp lệ thì ghi question attempt/counter; trả `{ reviewState, isCorrect }` |
| `review` | như attempt, nhưng route legacy | Cập nhật review mà không ghi `question_attempts` qua nhánh `storeAttempt=false` |
| `complete` | `sessionId`, `correctCount`, `totalQuestions` | Ghi completed time, score và counters; trả `{ completed: true }` |

Các error gồm `INVALID_REQUEST`, `AUTH_REQUIRED`, `DECK_NOT_FOUND`, `VOCABULARY_EMPTY`, `VOCABULARY_NO_MEANINGS`, `VOCABULARY_NOT_FOUND`, `EXERCISE_SET_NOT_FOUND`, `AI_QUOTA_EXCEEDED` và `LEARNING_OPERATION_FAILED`. Một số lỗi DB bị chuyển thành generic learning error; không giả định mọi lỗi có mã chi tiết như blueprint.

Exercise types runtime: `flashcard`, `multiple_choice_meaning`, `multiple_choice_term`, `typing_meaning`, `typing_term`, `translation`, `reverse_translation`, `fill_blank`, `true_false`, `context_choice`, `scrambled_letters`, `matching_pairs`, `odd_one_out`, `example_choice`, `context_cloze`.

Gemini schema đòi hỏi `deckItemId`, `type`, `prompt`, `choices`, `answer`, `acceptedAnswers`, `explanation`, `difficulty`, `payload`. Semantic checks xác nhận số lượng chính xác, item thuộc vocabulary pool, type nằm trong modes cho phép, câu hỏi không trùng, choice question có ít nhất 2 lựa chọn và answer nằm trong choices, matching có ít nhất một pair. Vocabulary pool lấy tối đa 500 deck items, sắp due/weak trước, giữ tối đa 100 item có meaning. Quota là 5 generation requests mỗi user mỗi giờ, tiêu thụ trước khi gọi Gemini; lỗi Gemini/validation dùng deterministic fallback.

## Database và RPC

Schema chi tiết canonical nằm trong migration `20260926000000_initial_schema.sql`; `infra/supabase.sql` có cùng logic, thêm chú thích hướng dẫn.

| Bảng | Vai trò |
|---|---|
| `profiles` | Thông tin profile gắn `auth.users` |
| `languages` | Language registry; seed `en`, `vi`, `ja`, `ko` |
| `lexemes` | Từ dùng chung, unique theo `(language_id, normalized_term)` |
| `senses` | Định nghĩa/POS; unique theo lexeme, definition language, definition, POS |
| `translations` | Bản dịch theo sense/target language |
| `examples` | Ví dụ và sentence translation theo sense |
| `lexicon_cache` | Cache provider theo query/source/target/provider và expiry |
| `ai_generation_usage` | Cửa sổ quota Gemini theo user |
| `decks` | Deck user, source/target language khác nhau, archive flag |
| `deck_items` | Liên kết deck với lexeme; unique `(deck_id, lexeme_id)` |
| `review_states` | Mastery/stability/difficulty/counters/next review theo deck item |
| `exercise_sets` | Metadata generation/config/model/prompt version |
| `exercise_questions` | Câu hỏi và JSON payload/answer |
| `practice_sessions` | Session, completion, score và counters |
| `question_attempts` | Submitted answer, correctness, time và timestamp |

Các PostgreSQL functions/RPC:

- `handle_new_user()`: trigger tạo profile khi auth user mới được thêm.
- `consume_ai_generation_quota(p_user_id, p_limit)`: khóa usage row, reset cửa sổ sau 1 giờ, tăng số request hoặc trả quota exhausted.
- `create_exercise_set_with_questions(...)`: xác nhận deck owner và count 10–100, ghi exercise set/question transactionally, đóng gói choices/answer trong JSONB.
- `import_vocabulary_batch(p_user_id, p_deck_id, p_items)`: xác nhận deck; upsert lexeme/senses/translations/examples; bỏ qua duplicate deck item và đếm inserted/duplicate/failed.
- `record_review(p_user_id, p_deck_item_id, p_is_correct, p_response_time_ms)`: xác nhận deck item thuộc user, cập nhật mastery/stability/streak/counters và next review.

Indexes hiện có: `idx_lexemes_language_term`, `idx_decks_user`, `idx_deck_items_deck`, `idx_review_next`, `idx_attempts_session`, `idx_cache_lookup`.

RLS bật cho tất cả bảng. `profiles`, decks, deck items, review states, exercise sets/questions, sessions/attempts có owner policy; languages/shared lexicon đọc bởi authenticated; cache và quota không cho authenticated truy cập trực tiếp. Bảng/functions nhạy cảm bị revoke khỏi `anon`/`public`/`authenticated`, cấp service role theo nhu cầu. Không thay đổi policy/RPC mà không xem lại boundary giữa anonymous authenticated user và admin client.

## Environment và secret boundary

| Biến | Nơi dùng | Phân loại |
|---|---|---|
| `SUPABASE_URL` | Angular build/runtime config, Edge Functions | URL project; frontend được biết |
| `SUPABASE_PUBLISHABLE_KEY` | Angular, Edge Functions | Public/publishable key; không phải secret authorization |
| `SUPABASE_PUBLISHABLE_KEYS` | Edge Functions hosted key map JSON | Public key map; server-side lookup |
| `SUPABASE_ANON_KEY` | Edge Functions legacy fallback | Legacy publishable/anon key |
| `SUPABASE_SECRET_KEYS` | Edge Functions | JSON secret key map; server secret |
| `SUPABASE_SECRET_KEY` | Edge Functions | Server secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions legacy fallback | Server secret, service-role privileges |
| `GEMINI_API_KEY` | `learning-api` | Server secret |
| `GEMINI_MODEL` | `learning-api` | Tên model, default `gemini-2.5-flash` |

`.env.example` và `src/environments/environment.example.ts` chỉ dành cho cấu hình public. `supabase/functions/.env.example` là local template; file `.env` thực tế bị ignore. GitHub Pages chỉ nhận URL và publishable key. `scripts/write-github-environment.mjs` ghi `src/environments/environment.ts` trong CI; không đưa secrets backend vào workflow frontend.

## Invariants cần giữ

- `source_language_id != target_language_id` cho deck.
- Term identity dùng NFKC + trim + gộp whitespace + locale-aware lowercase; không thay display term bằng normalized term.
- Deck item không duplicate trong cùng deck; import trả counter insert/duplicate/failure.
- Mọi thao tác admin đối với dữ liệu riêng tư phải kiểm tra user/deck ownership.
- Candidate chỉ import được khi có definition; backend có thể tra details lại nếu candidate chưa có senses.
- Không coi script detector hiện tại là hỗ trợ phân loại mọi ngôn ngữ.
- Không gửi secret tới Angular; không gọi Gemini trực tiếp từ browser.
- AI questions phải dùng deckItemId có thật trong pool, đúng số câu, đúng lựa chọn/payload; giữ fallback deterministic.
- Quota generation hiện là 5/lượt user/giờ. Đây là quota cho AI set generation; không nhầm với rate limit search.
- Review đúng: gain mastery 0.08 nếu response 1–5000 ms, nếu không 0.04; stability nhân 1.25, cap 365 ngày; hẹn tối thiểu 1 ngày. Sai: mastery trừ 0.1, stability nhân 0.7 tối thiểu 1, streak reset và hẹn lại 10 phút.
- `record_review` PostgreSQL là write path đang dùng cho review. `calculateLearningUpdate()` ở frontend là pure helper cùng chính sách nhưng hiện không phải đường ghi persistence.
