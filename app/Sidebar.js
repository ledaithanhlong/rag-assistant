'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Chat' },
  { href: '/tai-lieu', label: 'Tài liệu' },
  { href: '/upload', label: 'Upload' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <h1>Trợ lý tài liệu</h1>
      <p className="tagline">Hỏi đáp trên tài liệu của riêng bạn.</p>

      <nav className="nav-links">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
