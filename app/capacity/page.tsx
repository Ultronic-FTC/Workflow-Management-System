"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import styles from "./capacity.module.css";

type CapacityTask = {
  id: string;
  title: string;
  project_name: string;
  status: string;
  estimated_minutes: number | null;
  deadline: string | null;
  is_lead: boolean;
  planned_minutes: number;
};

type CapacityMember = {
  id: string;
  name: string;
  role: string;
  division: string;
  sort_order: number;
  available_minutes: number;
  planned_minutes: number;
  remaining_minutes: number;
  over_capacity: boolean;
  workload_percent: number;
  unplanned_task_count: number;
  unestimated_task_count: number;
  note: string | null;
  tasks: CapacityTask[];
};

type CapacitySummary = {
  available_minutes: number;
  planned_minutes: number;
  remaining_minutes: number;
  over_capacity_count: number;
  unplanned_task_count: number;
  unestimated_task_count: number;
};

function mondayFor(date: Date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  return value;
}

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function moveWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + amount * 7);
  return ymd(date);
}

function formatWeek(weekStart: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${weekStart}T12:00:00`));
}

function hours(minutes: number) {
  const value = minutes / 60;
  if (Number.isInteger(value)) {
    return `${value} hr${value === 1 ? "" : "s"}`;
  }
  return `${value.toFixed(1)} hrs`;
}

function inputHours(minutes: number) {
  if (minutes === 0) return "0";
  const value = minutes / 60;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDeadline(value: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CapacityPage() {
  const { currentUser } = useCurrentUser();
  const [weekStart, setWeekStart] = useState(() => ymd(mondayFor(new Date())));
  const [members, setMembers] = useState<CapacityMember[]>([]);
  const [summary, setSummary] = useState<CapacitySummary>({
    available_minutes: 0,
    planned_minutes: 0,
    remaining_minutes: 0,
    over_capacity_count: 0,
    unplanned_task_count: 0,
    unestimated_task_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [availableHours, setAvailableHours] = useState("0");
  const [note, setNote] = useState("");
  const [planHours, setPlanHours] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadCapacity = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(`/api/capacity?week_start=${weekStart}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load capacity.");
      }

      setMembers(Array.isArray(payload.members) ? payload.members : []);
      setSummary(payload.summary ?? {
        available_minutes: 0,
        planned_minutes: 0,
        remaining_minutes: 0,
        over_capacity_count: 0,
        unplanned_task_count: 0,
        unestimated_task_count: 0,
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load capacity."
      );
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  const currentCapacity = useMemo(
    () => members.find((member) => member.id === currentUser?.id) ?? null,
    [members, currentUser]
  );

  const draftPlannedMinutes = useMemo(() => {
    return Object.values(planHours).reduce((sum, value) => {
      const parsed = Number.parseFloat(value);
      return sum + (Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 60)) : 0);
    }, 0);
  }, [planHours]);

  const draftAvailableMinutes = useMemo(() => {
    const parsed = Number.parseFloat(availableHours);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 60)) : 0;
  }, [availableHours]);

  function openMyCapacity() {
    if (!currentUser) return;

    const row = currentCapacity;
    setAvailableHours(inputHours(row?.available_minutes ?? 0));
    setNote(row?.note ?? "");
    setPlanHours(
      Object.fromEntries(
        (row?.tasks ?? []).map((task) => [
          task.id,
          inputHours(task.planned_minutes),
        ])
      )
    );
    setFormError("");
    setShowModal(true);
  }

  async function saveCapacity(event: FormEvent) {
    event.preventDefault();
    if (!currentUser) return;

    setSaving(true);
    setFormError("");

    try {
      const available = Number.parseFloat(availableHours);
      if (!Number.isFinite(available) || available < 0 || available > 168) {
        throw new Error("Available hours must be between 0 and 168.");
      }

      const plans = (currentCapacity?.tasks ?? []).map((task) => {
        const raw = Number.parseFloat(planHours[task.id] ?? "0");
        if (!Number.isFinite(raw) || raw < 0 || raw > 168) {
          throw new Error(`Enter valid planned hours for ${task.title}.`);
        }
        return {
          task_id: task.id,
          planned_minutes: Math.round(raw * 60),
        };
      });

      const response = await fetch("/api/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: currentUser.id,
          week_start: weekStart,
          available_minutes: Math.round(available * 60),
          note,
          plans,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save capacity.");
      }

      setShowModal(false);
      await loadCapacity();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save capacity."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">WEEKLY PLANNING</p>
          <h1>Capacity</h1>
          <p>Plan work against the time each team member can give this week.</p>
        </div>

        <div className={styles.weekControls}>
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekStart((current) => moveWeek(current, -1))}
          >
            ‹
          </button>
          <button className={styles.weekLabel} type="button" disabled>
            Week of {formatWeek(weekStart)}
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekStart((current) => moveWeek(current, 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="metrics-grid compact">
        <div className="metric cyan">
          <strong>{hours(summary.available_minutes)}</strong>
          <span>Available</span>
        </div>
        <div className="metric">
          <strong>{hours(summary.planned_minutes)}</strong>
          <span>Planned</span>
        </div>
        <div className={`metric ${summary.remaining_minutes < 0 ? "red" : "cyan"}`}>
          <strong>{hours(summary.remaining_minutes)}</strong>
          <span>Remaining</span>
        </div>
        <div className={`metric ${summary.over_capacity_count > 0 ? "red" : ""}`}>
          <strong>{summary.over_capacity_count}</strong>
          <span>Over Capacity</span>
        </div>
      </div>

      {(summary.unplanned_task_count > 0 || summary.unestimated_task_count > 0) && (
        <div className={styles.notice}>
          <strong>Planning gaps:</strong>{" "}
          {summary.unplanned_task_count} assigned task
          {summary.unplanned_task_count === 1 ? "" : "s"} still have no hours
          planned for this week, and {summary.unestimated_task_count} assigned task
          {summary.unestimated_task_count === 1 ? "" : "s"} have no total task estimate.
        </div>
      )}

      {loading && <div className={styles.loading}>Loading capacity…</div>}
      {!loading && loadError && <div className={styles.error}>{loadError}</div>}

      {!loading && !loadError && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2>Team Workload</h2>
            <button
              className={styles.updateButton}
              disabled={!currentUser}
              onClick={openMyCapacity}
              title={!currentUser ? "Select yourself first" : undefined}
            >
              Update My Capacity
            </button>
          </div>

          <div className={styles.table}>
            <div className={`${styles.row} ${styles.header}`}>
              <span>Member</span>
              <span>Available</span>
              <span>Planned</span>
              <span>Remaining</span>
              <span>Unplanned</span>
              <span>Workload</span>
            </div>

            {members.map((member) => (
              <div className={styles.row} key={member.id}>
                <div className={styles.memberName}>
                  <strong>{member.name}</strong>
                  <span>{titleCase(member.role)}</span>
                </div>
                <span>{hours(member.available_minutes)}</span>
                <span>{hours(member.planned_minutes)}</span>
                <span className={member.over_capacity ? styles.danger : undefined}>
                  {hours(member.remaining_minutes)}
                </span>
                <span>
                  {member.unplanned_task_count > 0 ? (
                    <span className={styles.unplanned}>
                      {member.unplanned_task_count} task
                      {member.unplanned_task_count === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className={styles.none}>—</span>
                  )}
                </span>
                <div
                  className={`${styles.workload} ${
                    member.over_capacity ? styles.over : ""
                  }`}
                  title={`${member.workload_percent}% planned`}
                >
                  <i
                    style={{
                      width: `${Math.min(100, member.workload_percent)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showModal && currentUser && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !saving) {
              setShowModal(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="capacity-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className="eyebrow">MY WEEK</p>
                <h2 id="capacity-modal-title">
                  {currentUser.name} · Week of {formatWeek(weekStart)}
                </h2>
              </div>
              <button
                className={styles.close}
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className={styles.form} onSubmit={saveCapacity}>
              <div className={styles.capacityFields}>
                <label>
                  Hours I Can Give This Week
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.25"
                    required
                    value={availableHours}
                    onChange={(event) => setAvailableHours(event.target.value)}
                  />
                </label>

                <label>
                  Note / Constraint
                  <textarea
                    maxLength={500}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional: exams Tuesday, unavailable Saturday, etc."
                  />
                </label>
              </div>

              <div className={styles.planSummary}>
                <div>
                  <span>Available</span>
                  <strong>{hours(draftAvailableMinutes)}</strong>
                </div>
                <div>
                  <span>Planned</span>
                  <strong>{hours(draftPlannedMinutes)}</strong>
                </div>
                <div>
                  <span>Remaining</span>
                  <strong
                    className={
                      draftAvailableMinutes - draftPlannedMinutes < 0
                        ? styles.danger
                        : undefined
                    }
                  >
                    {hours(draftAvailableMinutes - draftPlannedMinutes)}
                  </strong>
                </div>
              </div>

              <section className={styles.taskPlans}>
                <h3>Plan My Assigned Tasks</h3>
                <p className={styles.help}>
                  Enter how many hours you expect to spend on each assigned task
                  during this specific week. A task's total estimate can span
                  multiple weeks and multiple people.
                </p>

                {(currentCapacity?.tasks ?? []).length === 0 && (
                  <p className={styles.help}>
                    You currently have no active assigned tasks.
                  </p>
                )}

                {(currentCapacity?.tasks ?? []).map((task) => (
                  <div className={styles.taskPlanRow} key={task.id}>
                    <div className={styles.taskPlanInfo}>
                      <strong>{task.title}</strong>
                      <span>
                        {task.project_name} · {formatDeadline(task.deadline)} · Total estimate: {task.estimated_minutes == null ? "Not set" : hours(task.estimated_minutes)}
                      </span>
                      {task.estimated_minutes == null && (
                        <span className={styles.tag}>UNESTIMATED</span>
                      )}
                    </div>

                    <label>
                      Hours This Week
                      <input
                        type="number"
                        min="0"
                        max="168"
                        step="0.25"
                        value={planHours[task.id] ?? "0"}
                        onChange={(event) =>
                          setPlanHours((current) => ({
                            ...current,
                            [task.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
              </section>

              {formError && <p className={styles.formMessage}>{formError}</p>}

              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  type="button"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className={styles.submit} type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save My Week"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
