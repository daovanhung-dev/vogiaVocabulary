# Hướng dẫn agent cho VoGia

## Dự án

VoGia (tên UI hiện tại: Lexora) là ứng dụng học từ vựng đa ngôn ngữ. Frontend là Angular 19 standalone; backend dùng Supabase Auth, PostgreSQL/RLS và hai Supabase Edge Functions viết bằng TypeScript/Deno: `lexicon-api` và `learning-api`.

## Đọc context trước khi sửa

1. Đọc [mục lục và quy ước context](docs/agent-context/README.md).
2. Đọc [kiến trúc và luồng dữ liệu](docs/agent-context/architecture.md).
3. Đọc [hợp đồng API, database và bảo mật](docs/agent-context/contracts.md) khi thay đổi frontend/backend/schema.
4. Tra [danh mục file và function](docs/agent-context/file-and-function-index.md) để tìm điểm sửa đúng.
5. Xem [known issues và trạng thái kiểm tra](docs/agent-context/known-issues.md) trước khi sửa UI hoặc kết luận một lỗi còn/từng tồn tại.

## Quy tắc làm việc

- Code đang chạy là nguồn sự thật. `bd.md` là blueprint dài hạn; không coi các module hoặc tính năng chỉ nêu trong đó là đã triển khai.
- Giữ frontend theo standalone components, feature-based services, Signals/RxJS và Angular Material. Tránh đưa nghiệp vụ nhiều feature vào một service tổng hợp.
- Giữ hợp đồng dùng chung giữa Angular và Edge Functions trong `src/app/shared/models/domain.models.ts` cùng kiểu provider tương ứng ở `supabase/functions/lexicon-api/providers/provider.interface.ts`.
- Chuẩn hóa từ bằng Unicode NFKC, trim, gộp khoảng trắng và locale-aware lowercase qua `normalizeTerm`; dùng `normalized_term` khi so sánh/chống trùng.
- Kiểm tra tương thích ngôn ngữ ở UI và backend. Không tin language code do client gửi khi import; đối chiếu với ngôn ngữ của deck ở Edge Function.
- User data phải được giới hạn theo chủ sở hữu bằng RLS và kiểm tra ownership trong Edge Function cho thao tác dùng service-role client.
- Browser chỉ được nhận `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`. Không đưa `GEMINI_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, JSON secret key map hay provider private key vào environment frontend, bundle, log hoặc tài liệu.
- Gọi Wiktionary/Gemini và các thao tác cần secret qua Edge Functions. Gemini output phải được kiểm tra cấu trúc và tham chiếu vocabulary; giữ deterministic fallback khi generation lỗi.
- Khi đổi schema/RPC, cập nhật cả `supabase/migrations/` và `infra/supabase.sql` để giữ hai cách cài đặt đồng bộ.
- Khi đổi hành vi, cập nhật test phù hợp và các trang trong `docs/agent-context/`; thêm regression test cho lỗi đã được sửa nếu test layer hiện có hỗ trợ.
- Không đưa dữ liệu tài khoản, token hoặc credential từ `supabase/.temp` vào commit. Thư mục này là metadata local bị ignore.

## Lệnh dự án

- Cài dependency: `npm install` (CI dùng `npm ci`), cần Node.js 20+.
- Chạy local: `npm start`.
- Unit tests Angular/pure TypeScript: `npm run test:unit`.
- Build Angular: `npm run build`.
- Deno tests provider/language: `deno test --no-config supabase/functions/lexicon-api/providers/wiktionary.provider.test.ts supabase/functions/lexicon-api/services/language-compat.test.ts`.
- Type-check Edge Functions: `deno check --no-config supabase/functions/lexicon-api/index.ts supabase/functions/learning-api/index.ts`.
- Deploy database: `supabase db push`.
- Deploy functions: `supabase functions deploy lexicon-api --no-verify-jwt` và `supabase functions deploy learning-api --no-verify-jwt`.
- Deploy frontend: workflow `.github/workflows/deploy-pages.yml`; cần GitHub Actions secrets `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`.

## Trạng thái và phạm vi

Context mô tả snapshot tại commit `b12e8a5` và các tài liệu có mặt khi được tạo. Kiểm tra issue hiện tại trước khi giả định trạng thái production vẫn giống snapshot này. `node_modules`, `dist`, `.angular` và `supabase/.temp` là dependency/build/local metadata, không phải source để lập chỉ mục từng hàm. `package-lock.json` là lockfile, không phải mã runtime.
