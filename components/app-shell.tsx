import Link from "next/link";
import { ReactNode } from "react";

const nav = [
  ["/", "Team Board"],
  ["/projects", "Projects"],
  ["/capacity", "Capacity"],
  ["/ideas-decisions", "Ideas & Decisions"],
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Ultronic Team Manager home">
          <span className="brand-mark" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span><strong>ULTRONIC</strong><small>TEAM MANAGER</small></span>
        </Link>
        <div className="global-search">⌕&nbsp;&nbsp; Search tasks, projects, people…</div>
        <Link href="/login" className="ghost-button">Sign in</Link>
        <button className="primary-button">+ New Task</button>
      </header>
      <nav className="nav-tabs">
        {nav.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
      <main className="page">{children}</main>
    </div>
  );
}
