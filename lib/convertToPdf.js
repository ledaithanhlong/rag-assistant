import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';

// ---------- .docx -> PDF (qua HTML, giữ layout/bảng khá tốt) ----------
export async function docxToHtmlAndText(buffer) {
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const textResult = await mammoth.extractRawText({ buffer });
  return { html: htmlResult.value, text: textResult.value };
}

export async function htmlToPdfBuffer(html) {
  const styledHtml = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; padding: 24px; color: #1B231F; }
          table { border-collapse: collapse; width: 100%; margin: 12px 0; }
          td, th { border: 1px solid #999; padding: 6px 8px; }
          img { max-width: 100%; }
          h1, h2, h3 { margin-top: 18px; }
        </style>
      </head>
      <body>${html}</body>
    </html>`;

  // Trên Vercel (production/serverless): dùng puppeteer-core + Chromium build cho Linux.
  // Trên máy local (Windows/Mac lúc code): dùng puppeteer đầy đủ, tự tải Chromium đúng hệ điều hành.
  const isServerless = !!process.env.VERCEL;

  let browser;
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    const puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch({ headless: true });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// ---------- Ảnh (jpg/png) -> PDF 1 trang ----------
export async function imageToPdfBuffer(buffer, mimeType) {
  const pdfDoc = await PDFDocument.create();
  const image =
    mimeType === 'image/png' ? await pdfDoc.embedPng(buffer) : await pdfDoc.embedJpg(buffer);

  const maxWidth = 595; // khổ A4 (points)
  const maxHeight = 842;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;

  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  return Buffer.from(await pdfDoc.save());
}
