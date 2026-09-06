import pdfParse from 'pdf-parse';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { chunkText, chunkPages } from '../../../lib/chunk';
import { embedText, ocrImage } from '../../../lib/geminiClient';
import { docxToHtmlAndText, htmlToPdfBuffer, imageToPdfBuffer } from '../../../lib/convertToPdf';

const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };

export async function POST(request) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      }

      let docId = null;

      try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) {
          send({ type: 'error', message: 'Không có file nào được gửi lên.' });
          controller.close();
          return;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const lowerName = file.name.toLowerCase();
        const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
        const isDocx = lowerName.endsWith('.docx');
        const isImage = !!IMAGE_TYPES[file.type] || /\.(png|jpe?g)$/i.test(lowerName);

        let chunks = [];
        let fullText = '';
        let pdfBuffer = null; // buffer để lưu lên Storage cho việc xem lại

        send({ type: 'status', message: 'Đang trích xuất nội dung...' });

        if (isPdf) {
          const pageTexts = [];
          await pdfParse(buffer, {
            pagerender: async (pageData) => {
              const textContent = await pageData.getTextContent();
              const text = textContent.items.map((item) => item.str).join(' ');
              pageTexts.push(text);
              return text;
            },
          });
          fullText = pageTexts.join('\n\n');
          chunks = chunkPages(pageTexts);
          pdfBuffer = buffer; // đã là PDF sẵn, dùng luôn để xem lại

        } else if (isDocx) {
          send({ type: 'status', message: 'Đang chuyển .docx sang PDF...' });
          const { html, text } = await docxToHtmlAndText(buffer);
          fullText = text;
          chunks = chunkText(fullText);
          pdfBuffer = await htmlToPdfBuffer(html);

        } else if (isImage) {
          send({ type: 'status', message: 'Đang nhận diện chữ trong ảnh (OCR)...' });
          const mimeType = file.type || (lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg');
          fullText = await ocrImage(buffer, mimeType);
          chunks = chunkText(fullText || '(không nhận diện được chữ trong ảnh)');
          pdfBuffer = await imageToPdfBuffer(buffer, mimeType);

        } else {
          // .txt, .md
          fullText = buffer.toString('utf-8');
          chunks = chunkText(fullText);
        }

        if (!fullText.trim()) {
          send({ type: 'error', message: 'Không trích xuất được nội dung từ file này.' });
          controller.close();
          return;
        }

        // Tạo document trước để có id, dùng id đó đặt tên file trên Storage
        const { data: doc, error: docError } = await supabaseAdmin
          .from('documents')
          .insert({ title: file.name, content: fullText })
          .select()
          .single();
        if (docError) throw docError;
        docId = doc.id;

        if (pdfBuffer) {
          send({ type: 'status', message: 'Đang lưu bản PDF để xem lại...' });
          const storagePath = `${doc.id}.pdf`;
          const { error: storageError } = await supabaseAdmin.storage
            .from('document-files')
            .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
          if (storageError) throw storageError;

          const { data: publicUrlData } = supabaseAdmin.storage
            .from('document-files')
            .getPublicUrl(storagePath);

          await supabaseAdmin
            .from('documents')
            .update({ file_url: publicUrlData.publicUrl })
            .eq('id', doc.id);
        }

        send({ type: 'total', total: chunks.length });

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await embedText(chunks[i].content, 'RETRIEVAL_DOCUMENT');
          const { error: chunkError } = await supabaseAdmin.from('chunks').insert({
            document_id: doc.id,
            content: chunks[i].content,
            page: chunks[i].page,
            chunk_order: i,
            embedding,
          });
          if (chunkError) throw chunkError;
          send({ type: 'progress', done: i + 1, total: chunks.length });
        }

        send({ type: 'complete', documentId: doc.id, chunkCount: chunks.length });
      } catch (err) {
        console.error(err);
        send({ type: 'error', message: err.message || 'Có lỗi xảy ra khi xử lý file.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
}
