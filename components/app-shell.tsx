import Link from "next/link";
import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

const nav = [
  ["/", "Team Board"],
  ["/projects", "Projects"],
  ["/capacity", "Capacity"],
  ["/ideas-decisions", "Ideas & Decisions"],
];

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

        <div className="global-search">⌕&nbsp;&nbsp; Search tasks, projects, people…</div>

        {user ? (
          <div className="button-row">
            <span
              style={{
                alignSelf: "center",
                color: "#9ba7b5",
                fontSize: "12px",
                maxWidth: "180px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user.email ?? "Signed in"}
            >
              {user.email ?? "Signed in"}
            </span>
            <form action="/auth/signout" method="post">
              <button className="ghost-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="ghost-button">
            Sign in
          </Link>
        )}

        <button className="primary-button">+ New Task</button>
      </header>

      <nav className="nav-tabs">
        {nav.map(([href, label]) => (
          <Link href={href} key={href}>
            {label}
          </Link>
        ))}
      </nav>

      <main className="page">{children}</main>
    </div>
  );
}
