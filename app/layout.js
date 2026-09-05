import './globals.css';

export const metadata = {
  title: 'Trợ lý AI cá nhân',
  description: 'RAG assistant cho tài liệu cá nhân',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
