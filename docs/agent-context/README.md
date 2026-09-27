# Context agent: VoGia

## Mục đích

Bộ tài liệu này giúp agent hiểu code, kiến trúc, API, database, file và các vấn đề đã ghi nhận trước khi sửa dự án. Snapshot gốc được khảo sát tại commit `b12e8a5`; đây là tài liệu mô tả trạng thái lúc đó, không phải cam kết production chưa thay đổi.

## Thứ tự đọc

1. [`AGENTS.md`](../../AGENTS.md): quy tắc làm việc và lệnh thường dùng.
2. [`architecture.md`](architecture.md): runtime, module và các luồng người dùng.
3. [`contracts.md`](contracts.md): kiểu dữ liệu, API, database, RPC, bảo mật.
4. [`file-and-function-index.md`](file-and-function-index.md): tra cứu file, hàm, class, test.
5. [`known-issues.md`](known-issues.md): lỗi UI, lỗi đã giải quyết và kiểm tra gần nhất.

## Quy ước nguồn sự thật

- Runtime code, migrations, tests và workflow là bằng chứng về hành vi hiện tại.
- `README.md` là hướng dẫn setup/deploy; đối chiếu lệnh với config hiện tại.
- `bd.md` là blueprint/roadmap. Một tính năng được mô tả ở đó chưa chắc đã tồn tại trong runtime.
- `docs/bugs/2026-09-26-web-test.md` ghi nhận kiểm thử cũ và các lỗi nghiệp vụ sau đó đã được retest là resolved.
- `docs/bugs/2026-09-26-ui-regression.md` ghi nhận sáu vấn đề UI còn mở tại phiên kiểm thử 2026-09-27. File này vốn chưa được track khi khảo sát; giữ nguyên và kiểm tra trạng thái Git trước khi thay đổi.
- SQL có hai bản cài đặt tương đương về logic: migration dùng với Supabase CLI, `infra/supabase.sql` dùng để cài thủ công. Khi sửa schema/RPC, đồng bộ cả hai.

## Phạm vi kiểm kê

Đã kiểm kê mã và tài liệu dự án trong `src/`, `supabase/` (trừ `.temp` local), `infra/`, `scripts/`, `tests/`, `.github/`, `docs/` và file cấu hình/hướng dẫn tại root. Inventory bao gồm cả file chưa track về UI regression để agent không bỏ sót hiện trạng làm việc.

`node_modules/`, `dist/`, `.angular/` và `supabase/.temp/` là dependency/build/cache hoặc metadata local; không lập mục lục nội dung/hàm của chúng. `package-lock.json` được ghi nhận là lockfile. File `.gitignore` mô tả loại artifact bị bỏ qua.

## Cập nhật context

Khi thay đổi route, API shape, schema/RPC, secret boundary, provider, feature ownership hoặc trạng thái known issue, cập nhật tài liệu tương ứng cùng thay đổi code. Ghi trạng thái đã kiểm tra kèm lệnh, kết quả và hạn chế môi trường; không biến blueprint thành mô tả implementation nếu chưa có code/test tương ứng.
