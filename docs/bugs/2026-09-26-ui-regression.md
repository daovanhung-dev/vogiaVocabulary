# Báo cáo kiểm thử UI/functional Lexora

- Ngày chạy thực tế: 2026-09-27 00:10 (+07)
- Kế hoạch tham chiếu: 2026-09-26
- URL: https://daovanhung-dev.github.io/vogiaVocabulary/
- Trình duyệt: Chrome desktop, Chrome extension bridge
- Workspace: Supabase anonymous session hiện có
- Console: Không ghi nhận `error`, `warning` hoặc `warn` trong lần kiểm tra cuối
- Phạm vi: dashboard, routing, deck management, vocabulary search/import, vocabulary library, practice và responsive UI

## Tóm tắt

Đã kiểm thử các route và luồng chính của ứng dụng trên deployment thật. Các chức năng backend và persistence chính hoạt động: tạo/chỉnh sửa/archive deck, tìm kiếm/import English và Japanese vocabulary, lưu meaning, filter vocabulary, quick practice, AI fallback, dashboard metrics và hash routing.

Có 6 lỗi UI/UX mới được ghi nhận:

| ID | Mức độ | Lỗi | Trạng thái |
| --- | --- | --- | --- |
| BUG-UI-001 | Medium | Material icons hiển thị thành chuỗi chữ bị cắt trên toàn app | Open |
| BUG-UI-002 | High | Deep-link đổi `deckId` cùng pattern route giữ lại dữ liệu deck cũ | Open |
| BUG-UI-003 | Medium | Layout mobile mặc định để sidebar mở, làm nội dung chỉ còn khoảng 155px | Open |
| BUG-UI-004 | Low | Batch search hiển thị candidate exact trùng lặp | Open |
| BUG-UI-005 | Low | Search không có kết quả chỉ hiện generic hint, không báo rõ “no results” | Open |
| BUG-UI-006 | Low | Tên deck vượt 80 ký tự bị disable submit nhưng không có inline validation message | Open |

## Ma trận kiểm thử

| Nhóm | Kiểm thử | Kết quả |
| --- | --- | --- |
| Boot | Root URL tự vào `#/dashboard`, dashboard render đúng | Pass |
| Routing | Hash route, wildcard route, sidebar navigation, deep-link refresh | Pass khi reload |
| Routing | Đổi `deckId` cùng pattern route không reload | Fail — BUG-UI-002 |
| Dashboard | Active decks, words saved, review streak và recent decks | Pass |
| Decks | Tạo deck hợp lệ | Pass |
| Decks | Required fields và disable submit khi form invalid | Pass, nhưng thiếu inline message ở một số validation |
| Decks | Trùng learning/meaning language | Pass — hiện lỗi trực tiếp và disable submit |
| Decks | Tên dài hơn 80 ký tự | Pass về chặn submit, Fail về feedback UI — BUG-UI-006 |
| Decks | Edit và Cancel | Pass |
| Decks | Archive deck QA với confirm | Pass |
| Search | Search `apple`, candidate details, chọn candidate | Pass |
| Search | Candidate không có definition bị disable | Pass |
| Search | Search không có kết quả | Fail về feedback UX — BUG-UI-005 |
| Search | Batch `hello` + `world` | Pass về import, có candidate trùng — BUG-UI-004 |
| Search | Language mismatch Japanese trong English deck | Pass |
| Import | Import `apple`, meaning được lưu | Pass |
| Import | Import duplicate không tạo thêm row | Pass |
| Import | Import Japanese `こんにちは` vào Japanese → Vietnamese | Pass |
| Library | Search theo term/meaning | Pass |
| Library | Filter All, New, Learning, Mastered, Weak, Due today | Pass |
| Library | Dictionary details mở/đóng | Pass |
| Library | Remove word confirm flow | Blocked/unverified; QA word đã được khôi phục sau thao tác kiểm thử, dữ liệu hiện hữu không bị chạm |
| Practice | Deck rỗng, empty state và disabled buttons | Pass |
| Practice | Count ngoài khoảng 10–100 | Pass; feedback hiện trong setup |
| Practice | Difficulty, direction, game modes, Auto mix | Pass |
| Practice | Quick deterministic session | Pass |
| Practice | Multiple choice, typing, flashcard, feedback đúng/sai | Pass |
| Practice | Finish, score và Create another set | Pass |
| Practice | AI generation/fallback | Pass; fallback xuất hiện sau khoảng 30 giây kèm warning |
| Responsive | Dashboard, My decks, Practice ở viewport 390px | Fail — BUG-UI-003 |
| Browser | Console cuối phiên | Pass; không có lỗi/warning |

## Chi tiết lỗi

### BUG-UI-001 — Material icons hiển thị thành chữ bị cắt

- Mức độ: Medium
- Route tái hiện: dashboard, decks, add vocabulary, vocabulary, practice
- Bước tái hiện:
  1. Mở deployment trên Chrome desktop.
  2. Quan sát sidebar, nút action, search field và card header.
- Kết quả thực tế: Các icon như `space_dashboard`, `style`, `add`, `search`, `arrow_back` bị render thành text ligature nhưng container nhỏ nên chỉ thấy các đoạn như `sp`, `st`, `ac`, `sear`, `ar`.
- Kết quả mong đợi: Icon Material hiển thị đúng hình, không lộ tên icon dạng text.
- Bằng chứng: Screenshot dashboard và Add vocabulary trong phiên kiểm thử cho thấy icon bị cắt; computed style của `mat-icon` dùng `Roboto`/`Inter`, không dùng Material Icons font.
- Nguyên nhân có khả năng cao: `src/index.html` không nạp Material Icons font stylesheet trong khi UI sử dụng `mat-icon` với ligature names.
- Trạng thái: Open.

### BUG-UI-002 — Deep-link đổi deck giữ lại dữ liệu deck cũ

- Mức độ: High
- Route tái hiện: `/decks/:deckId`, `/decks/:deckId/add`, `/decks/:deckId/vocabulary`; có khả năng áp dụng cho `/practice`.
- Bước tái hiện:
  1. Mở một route của deck Japanese, ví dụ `QA-UI-JA-VI-20260926`.
  2. Đổi URL/hash trực tiếp sang route tương ứng của `QA-UI-EN-VI-20260926` trong cùng SPA, không reload trang.
  3. Quan sát URL và nội dung.
- Kết quả thực tế: URL đã chứa `deckId` mới nhưng page title, deck name, vocabulary và các link vẫn thuộc deck cũ. Ví dụ URL trỏ tới deck English nhưng Add vocabulary vẫn hiển thị `Search Japanese words`; vocabulary English vẫn hiển thị `apple` khi URL trỏ tới deck Japanese.
- Kết quả mong đợi: Khi `deckId` thay đổi, component phải reload deck/items và đồng bộ toàn bộ UI với URL mới.
- Nguyên nhân có khả năng cao: Các component đọc `ActivatedRoute.snapshot.paramMap` trong `ngOnInit()` nhưng không subscribe `paramMap`, nên Angular reuse component khi chỉ đổi route parameter.
- Ghi chú: Full page reload deep-link vẫn tải đúng dữ liệu.
- Trạng thái: Open.

### BUG-UI-003 — Responsive mobile bị bóp nội dung

- Mức độ: Medium
- Viewport: 390 × 844 CSS px; document client width đo được 375px.
- Route tái hiện: dashboard, My decks, practice.
- Bước tái hiện:
  1. Mở dashboard ở viewport khoảng 390px.
  2. Quan sát sidebar và vùng nội dung chính.
- Kết quả thực tế: Sidebar `mode="side"` vẫn mở mặc định, chiếm khoảng 210px; `main` chỉ còn khoảng 155px. Hero, tiêu đề deck, form và control practice bị xuống dòng/cắt nghiêm trọng. Menu toggle có thể đóng sidebar thủ công, nhưng trạng thái mở mặc định vẫn làm màn hình mobile gần như không sử dụng được.
- Kết quả mong đợi: Ở breakpoint mobile, sidebar nên đóng mặc định hoặc chuyển sang overlay; nội dung chính cần chiếm gần toàn bộ viewport.
- Bằng chứng: Screenshot dashboard, My decks và Practice ở viewport 390px; `mainWidth: 155` trước khi đóng sidebar.
- Trạng thái: Open.

### BUG-UI-004 — Batch search có candidate exact trùng lặp

- Mức độ: Low
- Route: `#/decks/5aa26d72-befb-4be9-8eb8-0faffb6c1f28/add`
- Bước tái hiện:
  1. Nhập batch `hello` và `world`.
  2. Bấm `Search batch`.
  3. Quan sát kết quả `world`.
- Kết quả thực tế: Danh sách hiển thị `40 candidates`; có hai row exact giống nhau cho `world`, cùng phonetic, part of speech và meaning.
- Kết quả mong đợi: Mỗi normalized term chỉ xuất hiện một candidate exact trong kết quả batch.
- Nguyên nhân có khả năng cao: Batch response được trả về và render trực tiếp; frontend không dedupe kết quả theo `normalizedTerm` sau khi ghép nhiều query.
- Trạng thái: Open.

### BUG-UI-005 — Không có feedback rõ khi search không có kết quả

- Mức độ: Low
- Route: Add vocabulary trong deck English QA.
- Bước tái hiện:
  1. Nhập `zzzzzznonword`.
  2. Chờ search hoàn tất.
- Kết quả thực tế: Spinner biến mất và UI quay về generic hint `Search for your next word.`; không có thông báo như `No results for “zzzzzznonword”`.
- Kết quả mong đợi: Hiển thị empty state riêng cho no-result, phân biệt với trạng thái chưa tìm kiếm.
- Trạng thái: Open.

### BUG-UI-006 — Validation tên deck thiếu message

- Mức độ: Low
- Route: `#/decks`
- Bước tái hiện:
  1. Nhập tên deck dài 81 ký tự.
  2. Blur khỏi field.
- Kết quả thực tế: Nút `Create deck` bị disable đúng, nhưng không có inline error giải thích vượt quá 80 ký tự; người dùng chỉ thấy form không submit được.
- Kết quả mong đợi: Hiển thị `Deck name must be 80 characters or fewer.` ngay dưới field.
- Nguyên nhân có khả năng cao: Form có `Validators.maxLength(80)` nhưng template không render `mat-error` cho field `name`.
- Trạng thái: Open.

## Đối chiếu lỗi cũ

Các lỗi trong `docs/bugs/2026-09-26-web-test.md` được kiểm tra lại theo hành vi production hiện tại:

- BUG-001 loading deck list: không tái hiện lỗi empty state; loading state hiển thị.
- BUG-002 same-language deck validation: đã pass.
- BUG-003 meaning không được lưu: không tái hiện; `apple`, `hello`, `world` và `こんにちは` đều có meaning/definition sau import.
- BUG-004 quick practice không phản hồi khi thiếu meaning: empty deck hiển thị guard và disable buttons.
- BUG-005 dashboard hardcode metrics: đã pass; dashboard cập nhật `4 active`, `5 words saved`, `2 days` sau QA actions.
- BUG-006 direct `/dashboard`: Chrome tải app và normalize về `#/dashboard`; HTTP status server-level chưa đo trong phiên UI này.
- BUG-007 cross-language Japanese import: đã pass; English deck hiển thị mismatch warning, Japanese deck import thành công.

## Dữ liệu QA còn lại

| Tên | ID | Trạng thái |
| --- | --- | --- |
| QA-UI-EN-VI-20260926 | `5aa26d72-befb-4be9-8eb8-0faffb6c1f28` | Active, 3 words: apple, hello, world |
| QA-UI-JA-VI-20260926 | `e29b84c7-e776-42c1-8953-6b075c99bc61` | Active, 1 word: こんにちは |
| QA-UI-EMPTY-20260926 | `8baa771c-7aea-4da7-8ffc-95365c0e9202` | Archived, empty; dùng để test archive |
| QA-UI-EMPTY-PRACTICE-20260926 | `a3e0fdb4-8f25-42ee-8467-143e0bab51ea` | Active, empty; dùng để test practice empty state |

Dữ liệu deck hiện hữu `f94052e8-21d8-4b7a-9498-244ef4d74e21` không bị chỉnh sửa hoặc xóa.
