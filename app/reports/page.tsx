"use client";

import { useEffect, useMemo, useState } from "react";
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
    activity_counts: number[];
    activity_total: number;
  };
  technical: {
    people: Pivot;
    projects: Pivot;
  };
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

function PivotTable({
  title,
  subtitle,
  firstColumn,
  pivot,
  months,
  tone,
}: {
  title: string;
  subtitle: string;
  firstColumn: string;
  pivot: Pivot;
  months: string[];
  tone: "operations" | "technical";
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
            </tr>
          </thead>

          <tbody>
            {pivot.rows.map((row) => (
              <tr key={row.key}>
                <th className={styles.stickyName}>{row.label}</th>
                {row.months.map((value, index) => (
                  <td key={index}>{hours(value)}</td>
                ))}
                <td className={styles.totalCell}>{hours(row.total)}</td>
              </tr>
            ))}

            {pivot.rows.length === 0 && (
              <tr>
                <td
                  className={styles.emptyRow}
                  colSpan={months.length + 2}
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
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
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

export default function ReportsPage() {
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
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

        if (!cancelled) {
          setData(payload);
          setYear(payload.year);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load reports."
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
              <span>Total Tracked Hours</span>
              <strong>
                {totalHours(operationsHours + technicalHours)}
              </strong>
              <small>{data.year}</small>
            </div>
          </section>

          <PivotTable
            title="Hours by Person"
            subtitle="Monthly operations hours for each team member."
            firstColumn="Name"
            pivot={data.operations.people}
            months={data.months}
            tone="operations"
          />

          <PivotTable
            title="Hours by Person"
            subtitle="Monthly technical hours for each team member."
            firstColumn="Name"
            pivot={data.technical.people}
            months={data.months}
            tone="technical"
          />

          <PivotTable
            title="Hours by Project"
            subtitle="Operations hours grouped by project."
            firstColumn="Project"
            pivot={data.operations.projects}
            months={data.months}
            tone="operations"
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
    </>
  );
}
