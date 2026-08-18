"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./capacity.module.css";

type ForecastTask = {
  id: string;
  title: string;
  project_name: string;
  deadline: string | null;
  status: string;
  priority: string;
  estimated_minutes: number | null;
  assigned_count: number;
  is_lead: boolean;
  overdue: boolean;
};

type ForecastMember = {
  id: string;
  name: string;
  role: string;
  division: string;
  sort_order: number;
  assignment_count: number;
  estimated_minutes: number;
  unestimated_count: number;
  weeks: ForecastTask[][];
  unscheduled: ForecastTask[];
};

type ForecastSummary = {
  unique_task_count: number;
  assignment_count: number;
  estimated_minutes: number;
  unestimated_task_count: number;
  overdue_task_count: number;
};

type ForecastPayload = {
  start_date: string;
  end_date: string;
  weeks: Array<{
    start: string;
    end: string;
  }>;
  summary: ForecastSummary;
  members: ForecastMember[];
};

function mondayFor(date: Date) {
  const copy = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0
  );
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function ymd(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fromYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(fromYmd(value));
}

function formatRange(start: string, end: string) {
  return `${formatShort(start)} – ${formatShort(end)}`;
}

function formatLongRange(start: string, end: string) {
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(fromYmd(start))} – ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(fromYmd(end))}`;
}

function formatHours(minutes: number | null) {
  if (minutes == null) return "No estimate";

  const value = minutes / 60;
  if (Number.isInteger(value)) {
    return `${value} hr${value === 1 ? "" : "s"}`;
  }

  return `${Number(value.toFixed(2))} hrs`;
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CapacityPage() {
  const startDate = useMemo(() => ymd(mondayFor(new Date())), []);
  const [data, setData] = useState<ForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/capacity/forward?start_date=${startDate}`,
        { cache: "no-store" }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load capacity forecast.");
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load capacity forecast."
      );
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">3-WEEK FORWARD LOOK</p>
          <h1>Capacity</h1>
          <p>
            See what each person is assigned over the next three weeks and the
            estimated time for every task.
          </p>
        </div>

        {data && (
          <div className={styles.rangeBadge}>
            {formatLongRange(data.start_date, data.end_date)}
          </div>
        )}
      </div>

      {loading && (
        <div className={styles.message}>Loading 3-week workload…</div>
      )}

      {!loading && error && (
        <div className={`${styles.message} ${styles.error}`}>{error}</div>
      )}

      {!loading && data && (
        <>
          <section className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <strong>{data.summary.unique_task_count}</strong>
              <span>Tasks in Next 3 Weeks</span>
            </div>

            <div className={styles.summaryCard}>
              <strong>{data.summary.assignment_count}</strong>
              <span>Person / Task Assignments</span>
            </div>

            <div className={styles.summaryCard}>
              <strong>{formatHours(data.summary.estimated_minutes)}</strong>
              <span>Unique Task Estimates</span>
            </div>

            <div
              className={`${styles.summaryCard} ${
                data.summary.unestimated_task_count > 0
                  ? styles.warningCard
                  : ""
              }`}
            >
              <strong>{data.summary.unestimated_task_count}</strong>
              <span>Tasks Missing Estimates</span>
            </div>

            <div
              className={`${styles.summaryCard} ${
                data.summary.overdue_task_count > 0
                  ? styles.dangerCard
                  : ""
              }`}
            >
              <strong>{data.summary.overdue_task_count}</strong>
              <span>Overdue Tasks</span>
            </div>
          </section>

          <div className={styles.explanation}>
            <strong>How to read this:</strong> each task shows its full task
            estimate. If multiple people are assigned to the same task, the
            estimate appears for each person so everyone can see what they are
            responsible for. The top-level estimated-hours total counts each
            task only once.
          </div>

          <section className={styles.forecast}>
            <div className={styles.forecastHeader}>
              <div>TEAM MEMBER</div>
              {data.weeks.map((week, index) => (
                <div key={week.start}>
                  <strong>
                    {index === 0 ? "THIS WEEK" : `WEEK ${index + 1}`}
                  </strong>
                  <span>{formatRange(week.start, week.end)}</span>
                </div>
              ))}
            </div>

            {data.members.map((member) => (
              <article className={styles.memberRow} key={member.id}>
                <header className={styles.member}>
                  <div>
                    <h2>{member.name}</h2>
                    <span>
                      {titleCase(member.role)} · {titleCase(member.division)}
                    </span>
                  </div>

                  <div className={styles.memberTotals}>
                    <strong>{member.assignment_count}</strong>
                    <span>
                      assignment{member.assignment_count === 1 ? "" : "s"}
                    </span>
                    <b>{formatHours(member.estimated_minutes)}</b>
                    <small>listed task estimates</small>
                  </div>
                </header>

                {member.weeks.map((tasks, weekIndex) => (
                  <div className={styles.weekCell} key={weekIndex}>
                    {tasks.length === 0 ? (
                      <span className={styles.empty}>No assigned tasks due</span>
                    ) : (
                      tasks.map((task) => (
                        <div className={styles.taskCard} key={task.id}>
                          <div className={styles.taskTop}>
                            <span>{task.project_name}</span>
                            {task.is_lead && <b>LEAD</b>}
                          </div>

                          <h3>{task.title}</h3>

                          <div className={styles.taskMeta}>
                            <strong>
                              {task.estimated_minutes == null
                                ? "NO ESTIMATE"
                                : `EST. ${formatHours(task.estimated_minutes)}`}
                            </strong>

                            <span
                              className={
                                task.overdue ? styles.overdue : undefined
                              }
                            >
                              {task.overdue ? "OVERDUE · " : ""}
                              Due {task.deadline
                                ? formatShort(task.deadline)
                                : "No date"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}

                {member.unscheduled.length > 0 && (
                  <div className={styles.unscheduled}>
                    <div className={styles.unscheduledLabel}>
                      <strong>NO DEADLINE</strong>
                      <span>
                        {member.unscheduled.length} assigned task
                        {member.unscheduled.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className={styles.unscheduledTasks}>
                      {member.unscheduled.map((task) => (
                        <div className={styles.unscheduledTask} key={task.id}>
                          <strong>{task.title}</strong>
                          <span>
                            {task.project_name} ·{" "}
                            {task.estimated_minutes == null
                              ? "No estimate"
                              : `Est. ${formatHours(task.estimated_minutes)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}

            {data.members.length === 0 && (
              <div className={styles.message}>
                No active team members were found.
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
