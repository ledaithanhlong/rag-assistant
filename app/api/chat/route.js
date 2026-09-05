import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { ai, CHAT_MODEL, embedText } from '../../../lib/geminiClient';

export async function POST(request) {
  try {
    const { question } = await request.json();
    if (!question) {
      return new Response(JSON.stringify({ error: 'Thiếu câu hỏi.' }), { status: 400 });
    }

    // 1. Biến câu hỏi thành vector
    const queryEmbedding = await embedText(question, 'RETRIEVAL_QUERY');

    // 2. Tìm các đoạn tài liệu liên quan nhất trong Supabase (pgvector)
    const { data: matches, error } = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: 5,
    });
    if (error) throw error;

    // 2b. Lấy tên file gốc cho từng đoạn, để hiển thị nguồn dễ hiểu hơn
    const docIds = [...new Set((matches || []).map((m) => m.document_id))];
    let docTitleMap = {};
    if (docIds.length > 0) {
      const { data: docs } = await supabaseAdmin
        .from('documents')
        .select('id, title')
        .in('id', docIds);
      docTitleMap = Object.fromEntries((docs || []).map((d) => [d.id, d.title]));
    }

    const sources = (matches || []).map((m) => ({
      title: docTitleMap[m.document_id] || 'Không rõ tài liệu',
      snippet: m.content.length > 280 ? m.content.slice(0, 280) + '…' : m.content,
    }));

    const context = (matches || [])
      .map((m, i) => `[Nguồn ${i + 1}]\n${m.content}`)
      .join('\n\n');

    const systemInstruction = `Bạn là trợ lý trả lời câu hỏi dựa trên các đoạn tài liệu được cung cấp dưới đây.
Chỉ trả lời dựa trên nội dung trong các đoạn này. Nếu không tìm thấy thông tin liên quan trong tài liệu, hãy nói rõ là không tìm thấy, không được tự bịa ra câu trả lời.
Khi trả lời, ghi chú nguồn dạng [Nguồn 1], [Nguồn 2] — nhưng CHỈ đặt 1 lần ở CUỐI mỗi đoạn hoặc mỗi ý lớn, không lặp lại sau từng câu hay từng gạch đầu dòng nhỏ lẻ.
Có thể dùng markdown cơ bản: in đậm bằng **, gạch đầu dòng bằng -. Nếu có nhiều nhóm ý khác nhau (ví dụ theo từng công ty, từng giai đoạn), hãy đặt tiêu đề ngắn cho mỗi nhóm dạng **Tên nhóm:** trên một dòng riêng trước khi liệt kê.

Các đoạn tài liệu liên quan:
${context || '(không tìm thấy đoạn nào liên quan)'}`;

    // 3. Gọi Gemini để trả lời, dùng streaming để chữ chạy dần
    const stream = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      contents: question,
      config: { systemInstruction },
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.text || '';
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // Gửi kèm thông tin nguồn qua header, client sẽ đọc trước khi stream text
        'X-Sources': encodeURIComponent(JSON.stringify(sources)),
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || 'Có lỗi xảy ra.' }), {
      status: 500,
    });
  }
}
