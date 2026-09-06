'use client';

import { useRef, useState } from 'react';

export default function UploadPage() {
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);

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

          if (evt.type === 'status') {
            updateQueueItem(id, { statusMessage: evt.message });
          } else if (evt.type === 'total') {
            updateQueueItem(id, { total: evt.total });
          } else if (evt.type === 'progress') {
            const elapsed = (Date.now() - startedAt) / 1000;
            const rate = evt.done / elapsed;
            const remaining = evt.total - evt.done;
            const eta = rate > 0 ? Math.max(1, Math.round(remaining / rate)) : null;
            updateQueueItem(id, { done: evt.done, total: evt.total, etaSeconds: eta });
          } else if (evt.type === 'complete') {
            updateQueueItem(id, { status: 'done', done: evt.chunkCount, total: evt.chunkCount, etaSeconds: 0 });
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
    const files = Array.from(fileList).filter((f) => /\.(pdf|txt|md|docx|png|jpe?g)$/i.test(f.name));
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

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="page-content centered">
      <h2 className="page-title">Thêm tài liệu</h2>
      <p className="page-sub">Kéo thả hoặc chọn nhiều file PDF/.txt/.md cùng lúc.</p>

      <label
        className={`upload-zone upload-zone-lg ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="zone-title">Kéo file vào đây, hoặc bấm để chọn</span>
        .pdf, .docx, .txt, .md, .png, .jpg — chọn được nhiều file cùng lúc
        <input
          type="file"
          accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {uploadQueue.length > 0 && (
        <div className="upload-queue upload-queue-lg">
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
                      <span>{item.total > 0 ? `${pct}%` : item.statusMessage || 'Đang bắt đầu...'}</span>
                      {item.etaSeconds != null && <span>còn ~{item.etaSeconds}s</span>}
                    </>
                  )}
                  {item.status === 'done' && <span>Xong — {item.total} đoạn. Xem ở trang Tài liệu.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
