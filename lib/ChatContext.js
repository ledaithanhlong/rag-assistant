'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    loadSessions(true);
  }, []);

  async function loadSessions(autoSelectFirst = false) {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      const list = data.sessions || [];
      setSessions(list);
      if (autoSelectFirst && list.length > 0) {
        selectSession(list[0].id);
      }
    } finally {
      setLoadingSessions(false);
    }
  }

  async function selectSession(id) {
    setCurrentSessionId(id);
    setMessages([]);
    const res = await fetch(`/api/sessions/${id}/messages`);
    const data = await res.json();
    setMessages(
      (data.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        openSourceIndex: null,
      }))
    );
  }

  async function createNewSession() {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setSessions((s) => [data.session, ...s]);
    setCurrentSessionId(data.session.id);
    setMessages([]);
    return data.session.id;
  }

  async function deleteSession(id) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((s) => s.filter((sess) => sess.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
    }
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

  async function askQuestion(q) {
    if (!q.trim() || asking) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
    }

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
        body: JSON.stringify({ question: q, sessionId }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Lỗi khi gửi câu hỏi.');
      }

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

      // Cập nhật lại danh sách session (tiêu đề mới, thứ tự theo updated_at)
      loadSessions(false);
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
    <ChatContext.Provider
      value={{
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat phải dùng bên trong ChatProvider');
  return ctx;
}
