import './globals.css';
import { ChatProvider } from '../lib/ChatContext';
import Sidebar from './Sidebar';

export const metadata = {
  title: 'Trợ lý AI cá nhân',
  description: 'RAG assistant cho tài liệu cá nhân',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <ChatProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="page-area">{children}</div>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
