"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import styles from "./reports.module.css";

type PivotRow = {
  key: string;
  label: string;
  months: number[];
  total: number;
};

type Pivot = {
  rows: PivotRow[];
  month_totals: number[];
  grand_total: number;
};

type ReportsPayload = {
  year: number;
  years: number[];
  months: string[];
  operations: {
    people: Pivot;
    projects: Pivot;
    project_impact: Record<string, number>;
    impact_matrix: Array<{
      key: string;
      project_name: string;
      months: number[];
      task_months: boolean[];
      one_time: number;
      total: number;
    }>;
    impact_total: number;
    activity_counts: number[];
    activity_total: number;
  };
  technical: {
    people: Pivot;
    projects: Pivot;
  };
};

type PersonDetailPayload = {
  member: {
    id: string;
    name: string;
  };
  year: number;
  division: "operational" | "technical";
  months: string[];
  month_minutes: number[];
  total_minutes: number;
  entry_count: number;
  entries: Array<{
    id: string;
    date: string;
    project: string;
    task: string;
    category: string;
    hours_minutes: number;
    note: string | null;
    source: "Current Task" | "Historical";
  }>;
};


function hours(minutes: number) {
  const value = minutes / 60;

  if (Math.abs(value) < 0.0001) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function totalHours(minutes: number) {
  const value = minutes / 60;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function detailDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return value;

  const [, year, month, day] = match;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(
    new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0
    )
  );
}

function PivotTable({
  title,
  subtitle,
  firstColumn,
  pivot,
  months,
  tone,
  impactByKey,
  impactTotal,
  onPersonDetail,
}: {
  title: string;
  subtitle: string;
  firstColumn: string;
  pivot: Pivot;
  months: string[];
  tone: "operations" | "technical";
  impactByKey?: Record<string, number>;
  impactTotal?: number;
  onPersonDetail?: (row: PivotRow) => void;
}) {
  return (
    <section
      className={`${styles.panel} ${
        tone === "technical" ? styles.technicalPanel : styles.operationsPanel
      }`}
    >
      <div className={styles.panelHeading}>
        <div>
          <p>{tone === "technical" ? "TECHNICAL" : "OPERATIONS"}</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>

        <div className={styles.panelTotal}>
          <strong>{totalHours(pivot.grand_total)}</strong>
          <span>Total Hours</span>
        </div>
      </div>

      <div className={styles.tableScroller}>
        <table className={styles.pivotTable}>
          <thead>
            <tr>
              <th className={styles.stickyName}>{firstColumn}</th>
              {months.map((month) => (
                <th key={month}>{month}</th>
              ))}
              <th className={styles.totalHeader}>Total Hours</th>
              {impactByKey && (
                <th className={styles.impactHeader}>People Impacted</th>
              )}
            </tr>
          </thead>

          <tbody>
            {pivot.rows.map((row) => (
              <tr key={row.key}>
                <th className={styles.stickyName}>
                  {onPersonDetail ? (
                    <button
                      type="button"
                      className={styles.personDetailLink}
                      onClick={() => onPersonDetail(row)}
                      title={`View how ${row.label}'s hours are calculated`}
                    >
                      {row.label}
                    </button>
                  ) : (
                    row.label
                  )}
                </th>
                {row.months.map((value, index) => (
                  <td key={index}>{hours(value)}</td>
                ))}
                <td className={styles.totalCell}>
                  {onPersonDetail ? (
                    <button
                      type="button"
                      className={styles.personTotalLink}
                      onClick={() => onPersonDetail(row)}
                      title={`View ${row.label}'s detailed hours`}
                    >
                      {hours(row.total)}
                    </button>
                  ) : (
                    hours(row.total)
                  )}
                </td>
                {impactByKey && (
                  <td className={styles.impactCell}>
                    {impactByKey[row.key] ?? "—"}
                  </td>
                )}
              </tr>
            ))}

            {pivot.rows.length === 0 && (
              <tr>
                <td
                  className={styles.emptyRow}
                  colSpan={months.length + 2 + (impactByKey ? 1 : 0)}
                >
                  No hours have been recorded here yet.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr>
              <th className={styles.stickyName}>Grand Total</th>
              {pivot.month_totals.map((value, index) => (
                <td key={index}>{hours(value)}</td>
              ))}
              <td className={styles.totalCell}>
                {hours(pivot.grand_total)}
              </td>
              {impactByKey && (
                <td className={styles.impactCell}>
                  {new Intl.NumberFormat("en-US").format(impactTotal ?? 0)}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function PersonHoursDetailModal({
  memberId,
  memberName,
  year,
  division,
  onClose,
}: {
  memberId: string;
  memberName: string;
  year: number;
  division: "operational" | "technical";
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PersonDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          member_id: memberId,
          year: String(year),
          division,
        });

        const response = await fetch(
          `/api/reports/person-detail?${params.toString()}`,
          { cache: "no-store" }
        );

        const contentType = response.headers.get("content-type") ?? "";

        if (!contentType.includes("application/json")) {
          throw new Error("The detailed-hours API is not responding correctly.");
        }

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load detailed hours.");
        }

        if (!cancelled) {
          setDetail(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load detailed hours."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [memberId, year, division]);

  const divisionLabel =
    division === "technical" ? "Technical" : "Operations";

  return (
    <div className={styles.detailOverlay} onMouseDown={onClose}>
      <section
        className={styles.detailModal}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${memberName} detailed hours`}
      >
        <header className={styles.detailHeader}>
          <div>
            <p>{divisionLabel.toUpperCase()} · {year}</p>
            <h2>{memberName} — Hours Detail</h2>
            <span>
              Use this view to verify every date and hour included in the
              pivot-table total.
            </span>
          </div>

          <button
            type="button"
            className={styles.detailClose}
            onClick={onClose}
            aria-label="Close detailed hours"
          >
            ×
          </button>
        </header>

        {loading && (
          <div className={styles.detailMessage}>Loading detailed hours…</div>
        )}

        {!loading && error && (
          <div className={`${styles.detailMessage} ${styles.detailError}`}>
            {error}
          </div>
        )}

        {!loading && detail && (
          <>
            <div className={styles.detailSummary}>
              <div>
                <span>Total Hours</span>
                <strong>{hours(detail.total_minutes)}</strong>
              </div>
              <div>
                <span>Entries</span>
                <strong>{detail.entry_count}</strong>
              </div>
            </div>

            <div className={styles.monthAuditGrid}>
              {detail.months.map((month, index) => (
                <div className={styles.monthAuditCell} key={month}>
                  <span>{month}</span>
                  <strong>{hours(detail.month_minutes[index])}</strong>
                </div>
              ))}
            </div>

            <div className={styles.detailTableScroller}>
              <table className={styles.detailTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Task / Activity</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th>Source</th>
                    <th>Hours</th>
                  </tr>
                </thead>

                <tbody>
                  {detail.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{detailDate(entry.date)}</td>
                      <td>{entry.project}</td>
                      <td>{entry.task}</td>
                      <td>{entry.category}</td>
                      <td className={styles.detailNote}>
                        {entry.note || "—"}
                      </td>
                      <td>
                        <span
                          className={
                            entry.source === "Current Task"
                              ? styles.currentSource
                              : styles.historicalSource
                          }
                        >
                          {entry.source}
                        </span>
                      </td>
                      <td className={styles.detailHours}>
                        {hours(entry.hours_minutes)}
                      </td>
                    </tr>
                  ))}

                  {detail.entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.detailEmpty}>
                        No hours were found for this person in this report.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <th colSpan={6}>Validated Total</th>
                    <th className={styles.detailHours}>
                      {hours(detail.total_minutes)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ActivitiesPanel({
  months,
  counts,
  total,
}: {
  months: string[];
  counts: number[];
  total: number;
}) {
  const maxCount = Math.max(...counts, 1);

  return (
    <section className={`${styles.panel} ${styles.operationsPanel}`}>
      <div className={styles.panelHeading}>
        <div>
          <p>OPERATIONS</p>
          <h2>Number of Activities</h2>
          <span>
            A shared activity counts once even when several students
            participated.
          </span>
        </div>

        <div className={styles.panelTotal}>
          <strong>{total}</strong>
          <span>Grand Total</span>
        </div>
      </div>

      <div className={styles.activitiesLayout}>
        <div className={styles.barChart}>
          {months.map((month, index) => (
            <div className={styles.barColumn} key={month}>
              <div className={styles.barValue}>{counts[index]}</div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    height: `${Math.max(
                      counts[index] === 0
                        ? 0
                        : (counts[index] / maxCount) * 100,
                      counts[index] > 0 ? 7 : 0
                    )}%`,
                  }}
                />
              </div>
              <div className={styles.barMonth}>{month}</div>
            </div>
          ))}
        </div>

        <div className={styles.activityTableWrap}>
          <table className={styles.activityTable}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, index) => (
                <tr key={month}>
                  <td>{month}</td>
                  <td>{counts[index]}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Grand Total</th>
                <th>{total}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

function ImpactMatrix({
  year,
  months,
  rows,
  actorMemberId,
  onSaved,
}: {
  year: number;
  months: string[];
  rows: ReportsPayload["operations"]["impact_matrix"];
  actorMemberId: string;
  onSaved: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function cellKey(projectKey: string, month: number | null) {
    return `${projectKey}|${month == null ? "one-time" : month}`;
  }

  function displayedValue(
    projectKey: string,
    month: number | null,
    stored: number
  ) {
    const key = cellKey(projectKey, month);
    if (key in drafts) return drafts[key];
    return stored === 0 ? "" : String(stored);
  }

  async function saveCell(
    projectKey: string,
    projectName: string,
    month: number | null,
    stored: number
  ) {
    if (!actorMemberId) {
      setMessage("Select yourself under Working As before editing impact.");
      return;
    }

    const key = cellKey(projectKey, month);
    const draft = (drafts[key] ?? (stored === 0 ? "" : String(stored))).trim();

    if (draft === "" && stored === 0) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    const value = draft === "" ? null : Number(draft);

    if (
      value != null &&
      (!Number.isInteger(value) || value < 0)
    ) {
      setMessage("People impacted must be a whole number of 0 or more.");
      return;
    }

    if (value === stored) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    setSavingKey(key);
    setMessage("");

    try {
      const response = await fetch("/api/reports/impact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_member_id: actorMemberId,
          impact_year: year,
          project_id: projectKey,
          impact_month: month,
          people_impacted: value,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save impact.");
      }

      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });

      await onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save impact."
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className={`${styles.panel} ${styles.impactPanel}`}>
      <div className={styles.panelHeading}>
        <div>
          <p>OPERATIONS</p>
          <h2>People Impact by Project</h2>
          <span>
            Recurring programs use the monthly columns. One-time programs use
            the One-Time column. Totals calculate automatically.
          </span>
        </div>
      </div>

      <div className={styles.impactHelp}>
        <strong>Only projects from your Projects tab appear here.</strong>{" "}
        <span className={styles.greenKey}>Green cells</span> mean that project
        has a task or recorded activity in that month, so that is a likely
        month to enter impact. STEM Tent → enter each month's attendance.
        COASTWISE or RoboRumble → enter the single program total under{" "}
        <strong>One-Time</strong>.
      </div>

      {message && <div className={styles.impactMessage}>{message}</div>}

      <div className={styles.tableScroller}>
        <table className={`${styles.pivotTable} ${styles.impactEditTable}`}>
          <thead>
            <tr>
              <th className={styles.stickyName}>Project</th>
              {months.map((month) => (
                <th key={month}>{month}</th>
              ))}
              <th className={styles.oneTimeHeader}>One-Time</th>
              <th className={styles.totalHeader}>Total Impact</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th className={styles.stickyName}>{row.project_name}</th>

                {row.months.map((stored, index) => {
                  const key = cellKey(row.key, index + 1);

                  return (
                    <td
                      key={index}
                      className={`${styles.impactInputCell} ${
                        row.task_months[index]
                          ? styles.hasProjectTask
                          : ""
                      }`}
                      title={
                        row.task_months[index]
                          ? "This project has a task or recorded activity in this month."
                          : undefined
                      }
                    >
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={displayedValue(row.key, index + 1, stored)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        onBlur={() =>
                          saveCell(
                            row.key,
                            row.project_name,
                            index + 1,
                            stored
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        disabled={savingKey === key}
                        aria-label={`${row.project_name} ${months[index]} people impacted`}
                        placeholder="—"
                      />
                    </td>
                  );
                })}

                <td className={`${styles.impactInputCell} ${styles.oneTimeCell}`}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={displayedValue(
                      row.key,
                      null,
                      row.one_time
                    )}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [cellKey(row.key, null)]: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      saveCell(
                        row.key,
                        row.project_name,
                        null,
                        row.one_time
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={
                      savingKey === cellKey(row.key, null)
                    }
                    aria-label={`${row.project_name} one-time people impacted`}
                    placeholder="—"
                  />
                </td>

                <td className={styles.impactCell}>
                  {new Intl.NumberFormat("en-US").format(row.total)}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td className={styles.emptyRow} colSpan={15}>
                  No Operations projects are available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.autoSaveNote}>
        Values save automatically when you press Enter or click out of a cell.
      </div>
    </section>
  );
}

export default function ReportsPage() {
  const { currentUser } = useCurrentUser();
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [personDetail, setPersonDetail] = useState<{
    memberId: string;
    memberName: string;
    division: "operational" | "technical";
  } | null>(null);

  async function loadReports(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    }

    setError("");

    try {
      const query = year ? `?year=${year}` : "";
      const response = await fetch(`/api/reports${query}`, {
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error("The reports API is not responding correctly.");
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load reports.");
      }

      setData(payload);
      setYear(payload.year);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load reports."
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const operationsHours = useMemo(
    () => data?.operations.people.grand_total ?? 0,
    [data]
  );

  const technicalHours = useMemo(
    () => data?.technical.people.grand_total ?? 0,
    [data]
  );

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TEAM REPORTING</p>
          <h1>Hours Dashboard</h1>
          <p>
            Monthly hours and activity totals from historical work and
            current task time entries.
          </p>
        </div>

        {data && (
          <label className={styles.yearPicker}>
            Year
            <select
              value={data.year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {data.years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading && (
        <div className={styles.message}>Loading reports…</div>
      )}

      {!loading && error && (
        <div className={`${styles.message} ${styles.error}`}>{error}</div>
      )}

      {!loading && data && (
        <>
          <section className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Operations Hours</span>
              <strong>{totalHours(operationsHours)}</strong>
              <small>{data.year}</small>
            </div>

            <div className={`${styles.summaryCard} ${styles.technicalSummary}`}>
              <span>Technical Hours</span>
              <strong>{totalHours(technicalHours)}</strong>
              <small>{data.year}</small>
            </div>

            <div className={styles.summaryCard}>
              <span>Operations Activities</span>
              <strong>{data.operations.activity_total}</strong>
              <small>{data.year}</small>
            </div>

            <div className={styles.summaryCard}>
              <span>People Impacted</span>
              <strong>
                {new Intl.NumberFormat("en-US").format(
                  data.operations.impact_total
                )}
              </strong>
              <small>Operations · {data.year}</small>
            </div>

            <div className={styles.summaryCard}>
              <span>Total Tracked Hours</span>
              <strong>
                {totalHours(operationsHours + technicalHours)}
              </strong>
              <small>{data.year}</small>
            </div>
          </section>

          <PivotTable
            title="Hours by Person"
            subtitle="Monthly operations hours for each team member. Click a name or Total Hours to audit the detail."
            firstColumn="Name"
            pivot={data.operations.people}
            months={data.months}
            tone="operations"
            onPersonDetail={(row) =>
              setPersonDetail({
                memberId: row.key,
                memberName: row.label,
                division: "operational",
              })
            }
          />

          <PivotTable
            title="Hours by Person"
            subtitle="Monthly technical hours for each team member. Click a name or Total Hours to audit the detail."
            firstColumn="Name"
            pivot={data.technical.people}
            months={data.months}
            tone="technical"
            onPersonDetail={(row) =>
              setPersonDetail({
                memberId: row.key,
                memberName: row.label,
                division: "technical",
              })
            }
          />

          <ImpactMatrix
            year={data.year}
            months={data.months}
            rows={data.operations.impact_matrix}
            actorMemberId={currentUser?.id ?? ""}
            onSaved={() => loadReports({ silent: true })}
          />

          <PivotTable
            title="Hours by Project"
            subtitle="Operations hours grouped by project, with community impact."
            firstColumn="Project"
            pivot={data.operations.projects}
            months={data.months}
            tone="operations"
            impactByKey={data.operations.project_impact}
            impactTotal={data.operations.impact_total}
          />

          <PivotTable
            title="Hours by Project"
            subtitle="Technical hours grouped by project."
            firstColumn="Project"
            pivot={data.technical.projects}
            months={data.months}
            tone="technical"
          />

          <ActivitiesPanel
            months={data.months}
            counts={data.operations.activity_counts}
            total={data.operations.activity_total}
          />
        </>
      )}

      {personDetail && data && (
        <PersonHoursDetailModal
          memberId={personDetail.memberId}
          memberName={personDetail.memberName}
          year={data.year}
          division={personDetail.division}
          onClose={() => setPersonDetail(null)}
        />
      )}
    </>
  );
}
