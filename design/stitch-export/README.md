# Lexora — Stitch export/reference

Project Stitch mới: [Lexora Vocabulary Learning Dashboard](https://stitch.withgoogle.com/projects/3950273524615234343). Project tham khảo “Nihongo Learning System” được giữ nguyên.

## Nội dung trong thư mục

- `DESIGN.md`: design tokens do Stitch xuất trong ZIP.
- `mobile-my-decks/`: ZIP export thứ nhất đã giải nén (`code.html`, `screen.png`, `DESIGN.md`).
- `export-attempt-2/`: ZIP export thứ hai đã giải nén (`code.html`, `screen.png`, `DESIGN.md`).

Đây là artifact tham khảo, không phải Angular source và không phải nguồn chuẩn cho hành vi sản phẩm. HTML dùng Tailwind CDN, nội dung/demo data dựng sẵn và không nối API. Chỉ dùng để tham khảo bố cục, palette, typography và motion; runtime Angular cùng hợp đồng Supabase hiện tại vẫn là nguồn sự thật.

`DESIGN.md` do Stitch sinh có một số hướng dẫn copy từ mockup không đúng sản phẩm (ví dụ local streak/"Stored locally", audio-pronunciation actions, quota-free/offline claims và layout/session indicators). Chỉ tái sử dụng token màu, typography, spacing và các nguyên tắc motion/accessibility sau khi đối chiếu; không áp nguyên xi phần UX/copy này.

## Ghi nhận khi kiểm tra Stitch và export

Hai lần export `.zip` liên tiếp đều trả về cùng một màn **Mobile My Decks**, kể cả lần canvas đang chọn **Mobile Dashboard**. Hai file `code.html` giống nhau; ảnh `screen.png` cũng thể hiện My Decks. Vì vậy `export-attempt-2/` được đặt tên theo lần thử, không gắn nhãn Dashboard sai lệch.

HTML khai báo viewport `390×844`, nhưng export này chỉ là màn My Decks; không coi metadata export là xác nhận mọi frame đều đúng kích thước. Ban đầu có tám frame desktop và tám frame mobile; các lần Modify tiếp theo có thể tạo thêm frame trùng tên thay vì thay thế frame cũ. Luôn chọn frame đã rà soát theo nội dung và kích thước thay vì dựa vào tên đơn lẻ.

Accessibility tree của các bản cũ vẫn ghi nhận nội dung không hợp runtime: avatar/person icon, “Saved Locally”/local storage, số liệu giả, furigana/audio, XP/streak, và thông báo sync không có trong app. Một frame mới **Mobile Practice Session — feedback visible** đã được chọn và kiểm tra: artboard đúng `390×844`; có câu hỏi mẫu, đáp án đúng, explanation và action Next Question; loại bỏ avatar, local storage, audio, lore và sync claim. Đây là xác nhận của frame đó, không phải của mọi bản trùng tên.

Các frame được cập nhật sau đó cần được coi là prototype/reference, không phải đặc tả runtime đã xác thực. Kiểm tra trực tiếp các artboard **Mobile Vocabulary Library** và **Mobile Deck Details** cho thấy đúng tên/nội dung màn hình và cấu trúc ngôn ngữ, nhưng còn dữ liệu minh họa, metrics hoặc dictionary context cần đối chiếu với runtime. Với **Mobile Search & Add**, ngay trước accuracy pass còn thấy “Auto-sync”, HTTP 503 cố định, candidate count không khớp số input/nhãn importable và preview có chi tiết không thuộc ứng dụng. Với **Mobile Practice Setup**, một bản vẫn quảng bá “offline drills” và hiển thị lỗi session giả lập đồng thời cùng form; **Mobile Practice Complete** vẫn tuyên bố lưu cục bộ sau lỗi sync. Stitch có thể tạo frame trùng tên và narration của nó không đảm bảo artwork được thay đúng frame. Không dùng nội dung đó làm product truth.

Frame mới nhất **Mobile Search & Add** đã được kiểm tra trực tiếp ở đúng `390×844` qua artboard và Accessibility tree: input gồm `木漏れ日, 雨宿り, 木漏れ日; xyzw99`, trạng thái dedupe báo 2 term + 1 unresolved, có đúng 3 candidate (2 importable được chọn, 1 unresolved bị vô hiệu hóa), và nút cố định báo 2. Frame đó bỏ “Auto-sync”/offline/local-persistence, giữ session ẩn danh và import đi thẳng tới Vocabulary Library. Bản cũ trùng tên vẫn còn trong canvas với nội dung lỗi; chọn frame mới nhất khi review/export.

Frame khác chưa được coi là đã qua từng breakpoint hoặc luồng end-to-end; thiết kế generated vẫn có thể chứa preview/reference data không phải runtime. Các số liệu/từ ví dụ trong mockup chỉ là SAMPLE, không phải dữ liệu người dùng hay giá trị production.

Prototype end-to-end chưa được xác nhận trong Stitch. Export tải về chưa phản ánh frame vừa chọn; vì vậy HTML/ảnh chỉ là reference, không phải bản bàn giao đầy đủ cho tất cả screen. Chưa coi tất cả frame desktop/mobile là đã qua rà soát pixel và nghiệp vụ. Angular implementation loại bỏ các luồng không được runtime hỗ trợ; phần còn lại cần QA giao diện trên trình duyệt khi Node/npm khả dụng.

Không có credential, secret, token hay dữ liệu người dùng thật trong prompt hoặc export. Các tên/số liệu minh họa trong frame phải được hiểu là SAMPLE.
