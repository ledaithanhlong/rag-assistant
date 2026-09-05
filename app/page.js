'use client';

import { useEffect, useRef, useState } from 'react';

// ---------- Parser markdown tối giản: đủ dùng cho câu trả lời của Gemini ----------
// Hỗ trợ: **in đậm**, gạch đầu dòng (- hoặc *), danh sách số (1. 2. ...), và [Nguồn N] bấm được.
function renderInline(text, sources, onCite, keyPrefix) {
  const tokens = text.split(/(\*\*.*?\*\*|\[Nguồn \d+\])/g).filter((t) => t !== '');
  return tokens.map((token, i) => {
    const boldMatch = token.match(/^\*\*(.*)\*\*$/);
    if (boldMatch) {
      return <strong key={`${keyPrefix}-${i}`}>{boldMatch[1]}</strong>;
    }
    const citeMatch = token.match(/^\[Nguồn (\d+)\]$/);
    if (citeMatch) {
      const num = parseInt(citeMatch[1], 10);
      const hasSource = sources && sources[num - 1];
      return (
        <sup key={`${keyPrefix}-${i}`}>
          <button
            type="button"
            className="cite"
            disabled={!hasSource}
            onClick={() => hasSource && onCite(num)}
          >
            [{num}]
          </button>
        </sup>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{token}</span>;
  });
}

function renderMessageBody(content, sources, onCite) {
  const lines = content.split('\n');
  const blocks = [];
  let currentList = null; // { type: 'ul' | 'ol', items: [] }

  function flushList() {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  }

  lines.forEach((line, idx) => {
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
        if (headingMatch) {
          blocks.push({ type: 'h', text: headingMatch[1] + ':' });
        } else {
          blocks.push({ type: 'p', text: line });
        }
      }
    }
  });
  flushList();

  return blocks.map((block, i) => {
    const key = `b-${i}`;
    if (block.type === 'h') {
      return <div key={key} className="msg-heading">{block.text}</div>;
    }
    if (block.type === 'p') {
      return <p key={key} className="msg-p">{renderInline(block.text, sources, onCite, key)}</p>;
    }
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

export default function Home() {
  const scrollRef = useRef();
  const dragCounter = useRef(0);

  const [documents, setDocuments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]); // { id, name, size, status, done, total, etaSeconds, error }

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function loadDocuments() {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
    }
  }

  function updateQueueItem(id, patch) {
    setUploadQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function uploadOneFile(file) {
    const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploadQueue((q) => [
      ...q,
      { id, name: file.name, size: file.size, status: 'uploading', done: 0, total: 0, etaSeconds: null, error: null },
    ]);

    const startedAt = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.body) throw new Error('Trình duyệt không hỗ trợ đọc stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);

          if (evt.type === 'total') {
            updateQueueItem(id, { total: evt.total });
          } else if (evt.type === 'progress') {
            const elapsed = (Date.now() - startedAt) / 1000;
            const rate = evt.done / elapsed; // đoạn/giây
            const remaining = evt.total - evt.done;
            const eta = rate > 0 ? Math.max(1, Math.round(remaining / rate)) : null;
            updateQueueItem(id, { done: evt.done, total: evt.total, etaSeconds: eta });
          } else if (evt.type === 'complete') {
            updateQueueItem(id, { status: 'done', done: evt.chunkCount, total: evt.chunkCount, etaSeconds: 0 });
            loadDocuments();
          } else if (evt.type === 'error') {
            updateQueueItem(id, { status: 'error', error: evt.message });
          }
        }
      }
    } catch (err) {
      updateQueueItem(id, { status: 'error', error: err.message });
    }
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) =>
      /\.(pdf|txt|md)$/i.test(f.name)
    );
    files.forEach((file) => uploadOneFile(file));
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  }

  function handleDeleteDoc(docId) {
    if (!confirm('Xóa tài liệu này khỏi trợ lý?')) return;
    fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId }),
    }).then(loadDocuments);
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function toggleSource(messageIndex, sourceNum) {
    setMessages((m) => {
      const copy = [...m];
      const msg = copy[messageIndex];
      copy[messageIndex] = {
        ...msg,
        openSourceIndex: msg.openSourceIndex === sourceNum ? null : sourceNum,
      };
      return copy;
    });
  }

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim() || asking) return;

    const q = question;
    setQuestion('');
    const assistantIndex = messages.length + 1;
    setMessages((m) => [
      ...m,
      { role: 'user', content: q },
      { role: 'assistant', content: '', sources: [], openSourceIndex: null },
    ]);
    setAsking(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Lỗi khi gửi câu hỏi.');
      }

      // Đọc thông tin nguồn từ header trước khi đọc nội dung stream
      let sources = [];
      const rawSources = res.headers.get('X-Sources');
      if (rawSources) {
        try {
          sources = JSON.parse(decodeURIComponent(rawSources));
        } catch (e) {
          console.warn('Không đọc được X-Sources', e);
        }
      }
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIndex] = { ...copy[assistantIndex], sources };
        return copy;
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[assistantIndex] = { ...copy[assistantIndex], content: full };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIndex] = { role: 'assistant', content: 'Lỗi: ' + err.message, sources: [] };
        return copy;
      });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Trợ lý tài liệu</h1>
        <p className="tagline">Hỏi đáp trên tài liệu của riêng bạn.</p>

        <label
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="zone-title">Kéo file vào đây, hoặc bấm để chọn</span>
          .pdf, .txt, .md — chọn được nhiều file cùng lúc
          <input
            type="file"
            accept=".pdf,.txt,.md"
            multiple
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {uploadQueue.length > 0 && (
          <div className="upload-queue">
            {uploadQueue.map((item) => {
              const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
              return (
                <div className={`queue-item ${item.status}`} key={item.id}>
                  <div className="queue-row">
                    <span className="queue-name">{item.name}</span>
                    <span className="queue-size">{formatSize(item.size)}</span>
                  </div>
                  <div className="queue-bar-track">
                    <div
                      className="queue-bar-fill"
                      style={{ width: `${item.status === 'done' ? 100 : pct}%` }}
                    />
                  </div>
                  <div className="queue-meta">
                    {item.status === 'error' && <span className="queue-error">Lỗi: {item.error}</span>}
                    {item.status === 'uploading' && (
                      <>
                        <span>{item.total > 0 ? `${pct}%` : 'Đang bắt đầu...'}</span>
                        {item.etaSeconds != null && <span>còn ~{item.etaSeconds}s</span>}
                      </>
                    )}
                    {item.status === 'done' && <span>Xong — {item.total} đoạn</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="doc-list-label">Tài liệu đã thêm</div>
        {documents.length === 0 && <p className="doc-empty">Chưa có tài liệu nào.</p>}
        {documents.map((doc) => (
          <div className="doc-item" key={doc.id}>
            <span className="name">{doc.title}</span>
            <button onClick={() => handleDeleteDoc(doc.id)} aria-label="Xóa tài liệu">×</button>
          </div>
        ))}
      </aside>

      <div className="chat-area">
        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="chat-empty">
              Thêm một tài liệu ở sidebar bên trái, rồi hỏi bất cứ điều gì trong đó.
            </p>
          )}
          {messages.map((m, i) => (
            <div className={`bubble-row ${m.role}`} key={i}>
              <div className={`bubble ${m.role}`}>
                {m.role === 'assistant' ? (
                  <>
                    {renderMessageBody(m.content, m.sources, (num) => toggleSource(i, num))}
                    {m.openSourceIndex && m.sources?.[m.openSourceIndex - 1] && (
                      <div className="source-panel">
                        <div className="source-title">Đoạn trích {m.openSourceIndex}</div>
                        <div className="source-file">{m.sources[m.openSourceIndex - 1].title}</div>
                        <div className="source-snippet">
                          {m.sources[m.openSourceIndex - 1].snippet}
                        </div>
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

        <form className="ask-row" onSubmit={handleAsk}>
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
