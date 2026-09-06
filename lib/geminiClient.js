import { GoogleGenAI } from '@google/genai';

// Client dùng chung cho cả embedding lẫn sinh câu trả lời.
// Chỉ import file này ở phía server (API routes), không import vào component client.
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;
export const CHAT_MODEL = 'gemini-2.5-flash';

export async function embedText(text, taskType, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      });
      return response.embeddings[0].values;
    } catch (err) {
      const isRateLimit =
        err?.status === 429 || /rate.?limit|quota/i.test(err?.message || '');
      if (isRateLimit && attempt < retries) {
        const waitMs = 2000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

// Trích chữ từ ảnh bằng khả năng nhìn ảnh của Gemini — không cần thư viện OCR riêng.
export async function ocrImage(buffer, mimeType) {
  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          {
            text: 'Trích xuất toàn bộ văn bản có trong ảnh này, giữ nguyên thứ tự đọc tự nhiên. Chỉ trả về phần chữ, không thêm giải thích hay mô tả. Nếu ảnh không chứa chữ nào, hãy mô tả ngắn gọn nội dung ảnh bằng 1-2 câu.',
          },
        ],
      },
    ],
  });
  return response.text || '';
}
