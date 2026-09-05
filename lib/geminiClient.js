import { GoogleGenAI } from '@google/genai';

// Client dùng chung cho cả embedding lẫn sinh câu trả lời.
// Chỉ import file này ở phía server (API routes), không import vào component client.
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;
export const CHAT_MODEL = 'gemini-2.5-flash';

export async function embedText(text, taskType) {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType, // 'RETRIEVAL_DOCUMENT' khi lưu tài liệu, 'RETRIEVAL_QUERY' khi hỏi
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });
  return response.embeddings[0].values;
}
