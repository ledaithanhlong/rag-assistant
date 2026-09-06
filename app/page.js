'use client';

import { useEffect, useRef } from 'react';
import { useChat } from '../lib/ChatContext';

function renderInline(text, sources, onCite, keyPrefix) {
  const tokens = text.split(/(\*\*.*?\*\*|\[Nguồn[^\]]*\])/g).filter((t) => t !== '');
  return tokens.map((token, i) => {
    const boldMatch = token.match(/^\*\*(.*)\*\*$/);
    if (boldMatch) return <strong key={`${keyPrefix}-${i}`}>{boldMatch[1]}</strong>;

    const citeMatch = token.match(/^\[Nguồn([^\]]*)\]$/);
    if (citeMatch) {
      const nums = [...new Set((citeMatch[1].match(/\d+/g) || []).map((n) => parseInt(n, 10)))];
      return (
        <sup key={`${keyPrefix}-${i}`}>
          {nums.map((num, j) => {
            const hasSource = sources && sources[num - 1];
            return (
              <button
                key={j}
                type="button"
                className="cite"
                disabled={!hasSource}
                onClick={() => hasSource && onCite(num)}
              >
                [{num}]
              </button>
            );
          })}
        </sup>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{token}</span>;
  });
}

function renderMessageBody(content, sources, onCite) {
  const lines = content.split('\n');
  const blocks = [];
  let currentList = null;

  function flushList() {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  }

  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numberedMatch[1]);
    } else {
      flushList();
      if (line.trim() !== '') {
        const headingMatch = line.trim().match(/^\*\*(.+):\*\*$/);
        if (headingMatch) blocks.push({ type: 'h', text: headingMatch[1] + ':' });
        else blocks.push({ type: 'p', text: line });
      }
    }
  });
  flushList();

  return blocks.map((block, i) => {
    const key = `b-${i}`;
    if (block.type === 'h') return <div key={key} className="msg-heading">{block.text}</div>;
    if (block.type === 'p')
      return <p key={key} className="msg-p">{renderInline(block.text, sources, onCite, key)}</p>;
    const Tag = block.type === 'ul' ? 'ul' : 'ol';
    return (
      <Tag key={key} className="msg-list">
        {block.items.map((item, j) => (
          <li key={`${key}-${j}`}>{renderInline(item, sources, onCite, `${key}-${j}`)}</li>
        ))}
      </Tag>
    );
  });
}

export default function ChatPage() {
  const {
    sessions,
    currentSessionId,
    messages,
    question,
    setQuestion,
    asking,
    loadingSessions,
    askQuestion,
    toggleSource,
    selectSession,
    createNewSession,
    deleteSession,
  } = useChat();
  const scrollRef = useRef();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    const q = question;
    setQuestion('');
    askQuestion(q);
  }

  function handleDeleteSession(id, e) {
    e.stopPropagation();
    if (!confirm('Xóa đoạn hội thoại này? Không thể hoàn tác.')) return;
    deleteSession(id);
  }

  return (
    <div className="chat-page-shell">
      <div className="sessions-col">
        <button className="new-chat-btn" onClick={createNewSession}>+ Chat mới</button>
        {loadingSessions && <p className="doc-empty">Đang tải...</p>}
        {!loadingSessions && sessions.length === 0 && (
          <p className="doc-empty">Chưa có đoạn hội thoại nào.</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-row ${currentSessionId === s.id ? 'active' : ''}`}
            onClick={() => selectSession(s.id)}
          >
            <span className="session-title">{s.title || 'Cuộc trò chuyện mới'}</span>
            <button className="session-delete" onClick={(e) => handleDeleteSession(s.id, e)}>×</button>
          </div>
        ))}
      </div>

      <div className="chat-area">
        <div className="chat-scroll" ref={scrollRef}>
          {!currentSessionId && messages.length === 0 && (
            <p className="chat-empty">
              Bấm "+ Chat mới" hoặc chọn 1 đoạn hội thoại cũ bên trái, rồi hỏi bất cứ điều gì về tài liệu của bạn.
            </p>
          )}
          {currentSessionId && messages.length === 0 && (
            <p className="chat-empty">Chưa có tin nhắn nào trong đoạn hội thoại này. Hỏi gì đó đi.</p>
          )}
          {messages.map((m, i) => (
            <div className={`bubble-row ${m.role}`} key={i}>
              <div className={`bubble ${m.role}`}>
                {m.role === 'assistant' && m.content === '' && asking && i === messages.length - 1 ? (
                  <span className="typing-dots"><span></span><span></span><span></span></span>
                ) : m.role === 'assistant' ? (
                  <>
                    {renderMessageBody(m.content, m.sources, (num) => toggleSource(i, num))}
                    {m.openSourceIndex && m.sources?.[m.openSourceIndex - 1] && (
                      <div className="source-panel">
                        <div className="source-title">
                          Đoạn trích {m.openSourceIndex}
                          {m.sources[m.openSourceIndex - 1].page
                            ? ` — Trang ${m.sources[m.openSourceIndex - 1].page}`
                            : ''}
                        </div>
                        <div className="source-file">{m.sources[m.openSourceIndex - 1].title}</div>
                        <div className="source-snippet">{m.sources[m.openSourceIndex - 1].snippet}</div>
                      </div>
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
        </div>

        <form className="ask-row" onSubmit={handleSubmit}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Hỏi gì đó về tài liệu của bạn..."
          />
          <button type="submit" disabled={asking}>Gửi</button>
        </form>
      </div>
    </div>
  );
}
