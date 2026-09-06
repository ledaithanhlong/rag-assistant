# Trợ lý AI cá nhân (RAG) — Gemini + hỗ trợ docx/ảnh/OCR

## Trước khi chạy
1. Đã chạy đủ các file schema_*.sql theo đúng thứ tự (xem lịch sử trò chuyện với Claude nếu cần đối chiếu):
   - schema_rag.sql (gốc)
   - schema_rag_gemini_migration_fixed.sql (chuyển sang Gemini 768 chiều)
   - schema_rag_add_content_column.sql
   - schema_rag_add_page_tracking.sql
   - schema_rag_add_hide_sort.sql
   - schema_rag_add_storage.sql (bucket lưu PDF)
2. .env.local đã có sẵn key thật, không cần sửa.

## Chạy thử
```
npm install
npm run dev
```
Lần `npm install` này sẽ khá lâu và nặng hơn bình thường vì tải thêm Puppeteer + Chromium.

## Các loại file hỗ trợ
- .pdf — trích chữ theo từng trang, lưu nguyên bản để xem lại
- .docx — chuyển sang HTML rồi "in" thành PDF (giữ layout/bảng cơ bản, không đảm bảo giống 100% bản gốc)
- .png / .jpg — dùng Gemini OCR trích chữ trong ảnh, nhúng ảnh vào 1 trang PDF để xem lại
- .txt / .md — chỉ trích chữ thô, không có bản PDF để xem (xem dạng text như cũ)

## Giới hạn cần biết
- Ảnh sau khi OCR có thể trích chữ không hoàn hảo 100%, đặc biệt ảnh chữ viết tay hoặc chất lượng thấp.
- Chuyển đổi .docx dùng Puppeteer khá nặng — nếu deploy lên Vercel gói miễn phí (Hobby), có thể gặp lỗi vượt giới hạn dung lượng function hoặc timeout. Nếu gặp, cần thử nghiệm thêm hoặc cân nhắc bỏ tính năng convert .docx khi deploy production.
- File PDF lưu trên Supabase Storage bucket "document-files" ở chế độ public — không nên upload tài liệu chứa thông tin quá nhạy cảm.

## Deploy lên Vercel
Giống hướng dẫn cũ, nhưng lưu ý thêm: do Puppeteer nặng, lần build đầu có thể mất nhiều thời gian hơn,
và cần theo dõi kỹ log deploy để phát hiện lỗi liên quan dung lượng function nếu có.
