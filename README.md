# Trợ lý AI cá nhân (RAG) — bản dùng Gemini API

## Yêu cầu trước khi chạy
- Đã cài Node.js (kiểm tra bằng `node -v`, cần bản 18 trở lên)
- Đã chạy file `schema_rag.sql` VÀ `schema_rag_gemini_migration.sql` trong Supabase SQL Editor
  của project `rag-assistant` (theo đúng thứ tự đó)
- File `.env.local` trong thư mục này đã điền sẵn Gemini key + Supabase key thật —
  KHÔNG xóa dòng nào trong .gitignore, để file này không bao giờ bị đẩy lên GitHub.

## Chạy thử trên máy
```
npm install
npm run dev
```
Mở trình duyệt vào http://localhost:3000

## Cách dùng
1. Bấm vào ô "+ Thêm tài liệu" ở sidebar bên trái, chọn 1 file PDF/.txt/.md.
2. Đợi vài giây để hệ thống tách đoạn và tạo vector bằng Gemini.
3. Gõ câu hỏi liên quan tới nội dung file, bấm Gửi.
4. Câu trả lời hiện dần (streaming), có ghi chú [Nguồn 1], [Nguồn 2]... được tô nổi bật.
5. Xóa tài liệu bất kỳ lúc nào bằng nút × cạnh tên file trong sidebar.

## Về chi phí
Gemini 2.5 Flash và gemini-embedding-001 đều nằm trong gói miễn phí của Google AI Studio
(giới hạn theo số lượt gọi mỗi ngày, dư dùng cho một công cụ cá nhân). Không cần thẻ thanh toán.
Lưu ý: khi dùng free tier, nội dung bạn gửi có thể được Google dùng để cải thiện sản phẩm —
không nên upload tài liệu chứa thông tin nhạy cảm nếu bạn không muốn điều đó.

## Deploy lên Vercel
1. Đẩy code lên một repo GitHub MỚI (không chung với repo Portfolio CMS).
2. Vào Vercel → Add New → Project → chọn repo này → Import.
3. QUAN TRỌNG: vào Settings → Environment Variables trên Vercel, thêm 3 biến giống hệt
   trong .env.local (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
4. Bấm Deploy.

## Giới hạn hiện tại (bản MVP)
- Chỉ hỗ trợ PDF, .txt, .md — chưa đọc được .docx hay ảnh scan.
- Chưa có xác thực đăng nhập — vì đây là công cụ cá nhân, không nên public link rộng rãi
  (ai có link cũng dùng được, dù miễn phí nhưng vẫn có giới hạn lượt gọi mỗi ngày).
