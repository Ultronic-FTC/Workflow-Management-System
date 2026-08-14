"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProfileSwitcher } from "@/components/profile-switcher";

const nav = [
  ["/", "Team Board"],
  ["/projects", "Projects"],
  ["/capacity", "Capacity"],
  ["/ideas-decisions", "Ideas & Decisions"],
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function openNewTask() {
    if (pathname !== "/") {
      router.push("/");
      window.setTimeout(() => {
        window.dispatchEvent(new Event("ultronic:new-task"));
      }, 150);
      return;
    }

    window.dispatchEvent(new Event("ultronic:new-task"));
  }

  if (pathname === "/access") {
    return <main className="access-page">{children}</main>;
  }

  return (
    <div className="app-shell command-center-shell">
      <header className="topbar command-center-topbar">
        <Link
          href="/"
          className="brand command-center-brand"
          aria-label="Ultronic Team Command Center home"
        >
          <span className="command-center-logo-wrap">
            <img
              src="/ultronic-logo.png"
              alt=""
              className="command-center-logo"
            />
          </span>

          <span className="command-center-wordmark">
            <strong>ULTRONIC</strong>
            <small>TEAM COMMAND CENTER</small>
          </span>
        </Link>

        <div className="global-search command-center-search">
          <span className="command-search-icon">⌕</span>
          <span>Search tasks, projects, people…</span>
        </div>

        <ProfileSwitcher />

        <form action="/api/access/signout" method="post">
          <button
            className="ghost-button compact-button command-center-lock"
            type="submit"
            title="Lock team app"
          >
            Lock
          </button>
        </form>

        <button
          className="primary-button command-center-new-task"
          type="button"
          onClick={openNewTask}
        >
          + New Task
        </button>
      </header>

      <nav className="nav-tabs command-center-nav">
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
