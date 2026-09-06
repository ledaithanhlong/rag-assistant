// Chia văn bản thô (không có thông tin trang) thành các đoạn nhỏ.
// Dùng cho .txt/.md — không có khái niệm "trang".
export function chunkText(text, chunkSizeWords = 300, overlapWords = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + chunkSizeWords);
    chunks.push({ content: slice.join(' '), page: null });
    i += chunkSizeWords - overlapWords;
  }
  return chunks;
}

// Chia theo từng trang PDF, giữ lại số trang cho mỗi đoạn.
// pages: mảng string, mỗi phần tử là text của 1 trang.
export function chunkPages(pages, chunkSizeWords = 300, overlapWords = 50) {
  const allChunks = [];
  pages.forEach((pageText, idx) => {
    const pageNumber = idx + 1;
    const words = pageText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    let i = 0;
    while (i < words.length) {
      const slice = words.slice(i, i + chunkSizeWords);
      allChunks.push({ content: slice.join(' '), page: pageNumber });
      i += chunkSizeWords - overlapWords;
    }
  });
  return allChunks;
}
