// Chia văn bản dài thành các đoạn nhỏ, có phần chồng lấp (overlap)
// để không bị mất ngữ cảnh ở ranh giới giữa 2 đoạn.
export function chunkText(text, chunkSizeWords = 300, overlapWords = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + chunkSizeWords);
    chunks.push(slice.join(' '));
    i += chunkSizeWords - overlapWords;
  }
  return chunks;
}
