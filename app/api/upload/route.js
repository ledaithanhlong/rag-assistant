import pdfParse from 'pdf-parse';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { chunkText } from '../../../lib/chunk';
import { embedText } from '../../../lib/geminiClient';

// Trả về dạng stream NDJSON: mỗi dòng là 1 object JSON báo tiến trình.
// Client đọc từng dòng để cập nhật % theo thời gian thực, thay vì chờ xong mới biết.
export async function POST(request) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      }

      try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
          send({ type: 'error', message: 'Không có file nào được gửi lên.' });
          controller.close();
          return;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let text = '';
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const parsed = await pdfParse(buffer);
          text = parsed.text;
        } else {
          text = buffer.toString('utf-8');
        }

        if (!text.trim()) {
          send({ type: 'error', message: 'Không trích xuất được nội dung từ file này.' });
          controller.close();
          return;
        }

        const { data: doc, error: docError } = await supabaseAdmin
          .from('documents')
          .insert({ title: file.name })
          .select()
          .single();

        if (docError) throw docError;

        const chunks = chunkText(text);
        send({ type: 'total', total: chunks.length });

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await embedText(chunks[i], 'RETRIEVAL_DOCUMENT');
          const { error: chunkError } = await supabaseAdmin.from('chunks').insert({
            document_id: doc.id,
            content: chunks[i],
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
