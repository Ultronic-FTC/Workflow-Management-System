"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProfileSwitcher } from "@/components/profile-switcher";

const nav = [
  ["/", "Team Board"],
  ["/projects", "Projects"],
  ["/capacity", "Capacity"],
  ["/ideas-decisions", "Ideas & Decisions"],
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/access") {
    return <main className="access-page">{children}</main>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Ultronic Team Manager home">
          <span className="brand-mark" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span>
            <strong>ULTRONIC</strong>
            <small>TEAM MANAGER</small>
          </span>
        </Link>

        <div className="global-search">
          ⌕&nbsp;&nbsp; Search tasks, projects, people…
        </div>

        <ProfileSwitcher />

        <form action="/api/access/signout" method="post">
          <button className="ghost-button compact-button" type="submit" title="Lock team app">
            Lock
          </button>
        </form>

        <button className="primary-button">+ New Task</button>
      </header>

      <nav className="nav-tabs">
        {nav.map(([href, label]) => (
          <Link
            href={href}
            key={href}
            className={pathname === href ? "active" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      <main className="page">{children}</main>
    </div>
  );
}
