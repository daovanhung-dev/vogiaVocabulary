# Known issues và trạng thái kiểm tra

Tài liệu này ghi trạng thái theo hai báo cáo kiểm thử trong repository và kiểm tra local được thực hiện khi tạo context. Trước khi sửa hoặc báo lỗi production, kiểm tra lại code/deployment vì đây là snapshot.

## UI regression report và trạng thái worktree

Nguồn: `docs/bugs/2026-09-26-ui-regression.md`, kiểm thử Chrome trên GitHub Pages lúc 00:10 (+07), 2026-09-27.

| ID | Mức độ | Vấn đề trong báo cáo gốc | Thay đổi hiện có trong worktree |
|---|---|---|---|
| BUG-UI-001 | Medium | `mat-icon` hiển thị ligature text bị cắt; báo cáo nghi thiếu Material Icons font stylesheet | Đã khai báo Material Icons stylesheet trong `src/index.html`; cần kiểm tra browser/deploy để xác nhận font tải thành công. |
| BUG-UI-002 | High | Đổi `deckId` khi SPA reuse component có thể giữ deck cũ | Deck detail, add vocabulary, vocabulary và practice hiện theo dõi route params; dùng request version để bỏ kết quả stale. Chưa xác minh browser end-to-end. |
| BUG-UI-003 | Medium | Sidenav mở mặc định ở viewport 390px, bóp nội dung | `AppShellComponent` dùng `BreakpointObserver`, sidenav overlay trên mobile và bottom navigation hai route chính. Chưa xác minh browser ở 390×844. |
| BUG-UI-004 | Low | Batch result trùng candidate sau khi nối kết quả | `uniqueByNormalizedTerm()` dedupe theo NFKC/normalized term và giữ candidate đầu; kiểm tra logic bằng `deno eval`, Angular unit test đã thêm nhưng chưa chạy được do thiếu Node/npm. |
| BUG-UI-005 | Low | Search không có kết quả hiển thị generic hint | `AddVocabularyComponent` có trạng thái riêng cho chưa tìm, không có kết quả và lỗi tìm kiếm. |
| BUG-UI-006 | Low | Tên deck quá 80 ký tự bị chặn nhưng không có inline feedback | Form có `maxlength`, bộ đếm 80 ký tự và thông báo required/maxlength. |

Các thay đổi trên là sửa trong worktree của lần redesign 2026-09-27; chúng chưa được deploy và phần lớn chưa qua browser verification do thiếu Node/npm. Báo cáo gốc bên dưới vẫn là bằng chứng của phiên kiểm tra trước, không tự động cập nhật kết quả của phiên đó.

Báo cáo đánh dấu routing refresh, CRUD/archive deck, English/Japanese search/import, vocabulary filters, quick practice, AI fallback và dashboard metrics là pass; remove word confirmation chưa được xác minh hoàn toàn. Báo cáo cũng ghi console sạch tại lần kiểm tra cuối. Những điều này là bằng chứng tại thời điểm báo cáo, không phải cam kết trạng thái deployment hiện nay.

## Lỗi nghiệp vụ cũ được báo cáo là resolved

Nguồn: `docs/bugs/2026-09-26-web-test.md` và phần retest trong báo cáo UI ngày 27/09.

- BUG-001: loading deck list từng flash empty state; báo cáo mới cho biết không tái hiện.
- BUG-002: same learning/meaning language validation đã pass.
- BUG-003: meaning/definition không được lưu từ Wiktionary; parser hiện xử lý `definitions[].definition` và import được meaning.
- BUG-004: quick practice với item thiếu meaning từng im lặng; báo cáo mới xác nhận guard/empty-deck state.
- BUG-005: dashboard metrics từng hardcode; báo cáo mới xác nhận metrics cập nhật theo dữ liệu.
- BUG-006: direct route issue được mitigated bằng hash routing và Pages fallback; báo cáo cũ ghi refresh hash route pass. HTTP server status với path không hash chưa được xác nhận trong kiểm thử mới.
- BUG-007: query tiếng Nhật trong English deck được chặn; Japanese → Vietnamese search/import được xác nhận.

Đọc hai báo cáo gốc để lấy reproduction details, môi trường và giới hạn xác minh. Không xóa hoặc đổi trạng thái issue cũ chỉ dựa trên bản context này.

## Trạng thái kiểm tra local khi lập context

- Deno provider và backend language compatibility tests: `deno test --no-config supabase/functions/lexicon-api/providers/wiktionary.provider.test.ts supabase/functions/lexicon-api/services/language-compat.test.ts` — 8 passed, 0 failed.
- Edge Function type-check: `deno check --no-config supabase/functions/lexicon-api/index.ts supabase/functions/learning-api/index.ts` — pass.
- `npm run test:unit` không chạy được trong môi trường khảo sát vì không có `npm` (cũng không có `node` trong PATH). Đây là giới hạn toolchain hiện tại, không phải kết quả test fail của mã nguồn.
- Báo cáo web test cũ ghi unit tests/build pass trong môi trường Node riêng; xem báo cáo gốc để biết chính xác commit và phiên bản toolchain.

## Caveat còn cần nhớ

- Cần chạy lại responsive/browser QA và xác nhận Google Fonts cùng Material Icons tải thành công trên môi trường deploy.
- Các sửa lỗi route-param, batch dedupe, empty/error state và validation hiện chưa được unit/browser-test trên Angular vì môi trường này thiếu Node/npm.
- `SearchService.localRank()` xếp hạng kết quả single-query cục bộ; batch chỉ loại candidate trùng theo normalized term sau khi gộp kết quả, không phải semantic dedupe.
- Dashboard streak dựa trên question attempts và timezone trình duyệt mặc định, không phải profile timezone đã lưu.
- Client `calculateLearningUpdate()` và PostgreSQL `record_review()` cần được giữ cùng chính sách nếu review algorithm thay đổi.
- Cache/provider behavior thay đổi theo Wiktionary; provider có timeout/retry nhưng search/batch orchestration vẫn chịu latency external service.
