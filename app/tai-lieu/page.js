'use client';

import { useEffect, useState } from 'react';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDoc(null);
      return;
    }
    setLoadingDoc(true);
    fetch(`/api/documents/${selectedId}`)
      .then((res) => res.json())
      .then((data) => setSelectedDoc(data.document))
      .catch((err) => console.error(err))
      .finally(() => setLoadingDoc(false));
  }, [selectedId]);

  async function loadDocuments() {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocuments(data.documents || []);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('Xóa tài liệu này? Các đoạn trích dẫn liên quan cũng sẽ mất.')) return;
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (selectedId === id) setSelectedId(null);
    loadDocuments();
  }

  async function handleDeleteAll() {
    if (!confirm('Xóa TẤT CẢ tài liệu? Không thể hoàn tác. Toàn bộ nội dung và trích dẫn liên quan sẽ mất hết.')) return;
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setSelectedId(null);
    loadDocuments();
  }

  async function toggleHidden(doc, e) {
    e.stopPropagation();
    await fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: !doc.hidden }),
    });
    loadDocuments();
  }

  async function moveDoc(list, index, direction, e) {
    e.stopPropagation();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const a = list[index];
    const b = list[targetIndex];
    await Promise.all([
      fetch(`/api/documents/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/documents/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ]);
    loadDocuments();
  }

  const visibleDocs = documents.filter((d) => !d.hidden);
  const hiddenDocs = documents.filter((d) => d.hidden);

  function renderRow(doc, list, index) {
    return (
      <div
        key={doc.id}
        className={`doc-row ${selectedId === doc.id ? 'active' : ''}`}
        onClick={() => setSelectedId(doc.id)}
      >
        <div className="doc-row-arrows">
          <button onClick={(e) => moveDoc(list, index, -1, e)} disabled={index === 0}>↑</button>
          <button onClick={(e) => moveDoc(list, index, 1, e)} disabled={index === list.length - 1}>↓</button>
        </div>
        <span className="doc-row-name">{doc.title}</span>
        <div className="doc-row-actions">
          <button className="doc-row-hide" onClick={(e) => toggleHidden(doc, e)}>
            {doc.hidden ? 'Hiện' : 'Ẩn'}
          </button>
          <button className="doc-row-delete" onClick={(e) => handleDelete(doc.id, e)}>×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content docs-layout">
      <div className="docs-list-col">
        <div className="docs-header">
          <h2 className="page-title">Tài liệu</h2>
          {documents.length > 0 && (
            <button className="delete-all-btn" onClick={handleDeleteAll}>Xóa tất cả</button>
          )}
        </div>

        {documents.length === 0 && (
          <p className="doc-empty">Chưa có tài liệu nào. Qua trang Upload để thêm.</p>
        )}

        {visibleDocs.map((doc, i) => renderRow(doc, visibleDocs, i))}

        {hiddenDocs.length > 0 && (
          <div className="hidden-section">
            <button className="hidden-toggle" onClick={() => setShowHidden((s) => !s)}>
              {showHidden ? '▾' : '▸'} Tài liệu đã ẩn ({hiddenDocs.length})
            </button>
            {showHidden && (
              <p className="hidden-note">
                Tài liệu ẩn vẫn được dùng khi hỏi đáp và vẫn xuất hiện trong trích dẫn, chỉ không hiện ở danh sách chính.
              </p>
            )}
            {showHidden && hiddenDocs.map((doc, i) => renderRow(doc, hiddenDocs, i))}
          </div>
        )}
      </div>

      <div className="docs-view-col">
        {!selectedId && <p className="chat-empty">Chọn 1 tài liệu bên trái để xem nội dung.</p>}
        {loadingDoc && <p className="chat-empty">Đang tải...</p>}
        {selectedDoc && !loadingDoc && (
          <>
            <h3 className="doc-view-title">{selectedDoc.title}</h3>
            {selectedDoc.file_url ? (
              <iframe src={selectedDoc.file_url} className="pdf-frame" title={selectedDoc.title} />
            ) : (
              <div className="doc-view-content">{selectedDoc.content}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
