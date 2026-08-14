"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { useCurrentUser } from "@/components/current-user-provider";

const nav = [
  ["/", "Team Board"],
  ["/projects", "Projects"],
  ["/capacity", "Capacity"],
  ["/ideas-decisions", "Ideas & Decisions"],
  ["/operational-calendar", "Operational Calendar"],
];

const competitionEditors = new Set(["captain", "mentor", "coach"]);

function formatCompetitionDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function daysUntilCompetition(value: string) {
  const target = new Date(`${value}T12:00:00`);
  const today = new Date();
  const localToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12
  );

  return Math.ceil(
    (target.getTime() - localToday.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useCurrentUser();

  const [competitionDate, setCompetitionDate] = useState<string | null>(null);
  const [competitionLoaded, setCompetitionLoaded] = useState(false);
  const [showDateEditor, setShowDateEditor] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const canEditCompetitionDate = Boolean(
    currentUser && competitionEditors.has(currentUser.role)
  );

  const daysRemaining = useMemo(
    () => (competitionDate ? daysUntilCompetition(competitionDate) : null),
    [competitionDate]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCompetitionDate() {
      try {
        const response = await fetch("/api/settings/competition-date", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load competition date.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setCompetitionDate(payload.next_competition_date ?? null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setCompetitionLoaded(true);
        }
      }
    }

    loadCompetitionDate();

    return () => {
      cancelled = true;
    };
  }, []);

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

  function openDateEditor() {
    if (!canEditCompetitionDate) {
      return;
    }

    setDraftDate(competitionDate ?? "");
    setDateError("");
    setShowDateEditor(true);
  }

  async function saveCompetitionDate(event: FormEvent) {
    event.preventDefault();

    if (!currentUser) {
      setDateError("Select yourself under Working As first.");
      return;
    }

    setSavingDate(true);
    setDateError("");

    try {
      const response = await fetch("/api/settings/competition-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          next_competition_date: draftDate || null,
          actor_member_id: currentUser.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update date.");
      }

      setCompetitionDate(payload.next_competition_date ?? null);
      setShowDateEditor(false);
    } catch (error) {
      setDateError(
        error instanceof Error ? error.message : "Unable to update date."
      );
    } finally {
      setSavingDate(false);
    }
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
        <div className="command-center-nav-links">
          {nav.map(([href, label]) => (
            <Link
              href={href}
              key={href}
              className={pathname === href ? "active" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="competition-announcement">
          <span className="competition-label">NEXT COMPETITION</span>

          {competitionLoaded ? (
            competitionDate ? (
              <>
                <strong>{formatCompetitionDate(competitionDate)}</strong>
                <span className="competition-divider">·</span>
                <span className="competition-countdown">
                  {daysRemaining === 0
                    ? "TODAY"
                    : daysRemaining !== null && daysRemaining > 0
                      ? `${daysRemaining} DAY${daysRemaining === 1 ? "" : "S"}`
                      : "DATE PASSED"}
                </span>
              </>
            ) : (
              <strong>DATE NOT SET</strong>
            )
          ) : (
            <span className="competition-loading">Loading…</span>
          )}

          {canEditCompetitionDate && (
            <button
              type="button"
              className="competition-edit"
              onClick={openDateEditor}
            >
              EDIT
            </button>
          )}
        </div>
      </nav>

      <main className="page">{children}</main>

      {showDateEditor && (
        <div
          className="competition-editor-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !savingDate) {
              setShowDateEditor(false);
            }
          }}
        >
          <form
            className="competition-editor"
            onSubmit={saveCompetitionDate}
          >
            <div>
              <span className="competition-editor-eyebrow">
                TEAM SCHEDULE
              </span>
              <h2>Next Competition Date</h2>
              <p>
                This shared date appears across the Team Command Center.
              </p>
            </div>

            <label>
              Competition Date
              <input
                type="date"
                value={draftDate}
                onChange={(event) => setDraftDate(event.target.value)}
              />
            </label>

            {dateError && (
              <div className="competition-editor-error">{dateError}</div>
            )}

            <div className="competition-editor-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowDateEditor(false)}
                disabled={savingDate}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={savingDate}
              >
                {savingDate ? "Saving…" : "Save Date"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
