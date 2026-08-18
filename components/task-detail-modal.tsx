"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { TeamMember } from "@/lib/team-members";
import styles from "./task-detail-modal.module.css";

type ProjectOption = {
  id: string;
  name: string;
  division: "technical" | "operational" | "both";
  status: string;
};

type CategoryOption = {
  id: string;
  name: string;
  division: "technical" | "operational";
  sort_order: number;
};

type TaskDetail = {
  id: string;
  project_id: string;
  project_name: string;
  category_id: string;
  category_name: string;
  title: string;
  description: string | null;
  status:
    | "backlog"
    | "needs_assignment"
    | "assigned"
    | "in_progress"
    | "blocked"
    | "completed";
  priority: "low" | "normal" | "high" | "critical";
  difficulty: number | null;
  people_needed: number;
  estimated_minutes: number | null;
  deadline: string | null;
  lead_member_id: string | null;
  lead_name: string | null;
  poc_member_id: string | null;
  poc_name: string | null;
  blocked_reason: string | null;
  evidence_required: boolean;
  evidence_type: string | null;
  evidence_location: string | null;
  submitted_for_review_at: string | null;
  completed_at: string | null;
  approved_by_member_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  review_notes: string | null;
  assignees: Array<{
    member_id: string;
    name: string;
    role: string;
    assignment_source: string;
  }>;
  subtasks: Array<{
    id: string;
    title: string;
    assigned_member_id: string | null;
    estimated_minutes: number | null;
    completed: boolean;
    completed_at: string | null;
    sort_order: number;
  }>;
  time_entries: Array<{
    id: string;
    member_id: string;
    member_name: string;
    work_date: string;
    minutes: number;
    note: string | null;
    created_at: string;
  }>;
  actual_minutes: number;
  activity: Array<{
    id: string;
    actor_member_id: string | null;
    actor_name: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
};

type Props = {
  taskId: string;
  projects: ProjectOption[];
  categories: CategoryOption[];
  teamMembers: TeamMember[];
  currentUser: TeamMember | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

type Tab = "details" | "subtasks" | "time" | "activity";

const reviewerRoles = new Set(["captain", "mentor", "coach"]);

function titleCase(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null) return "Not set";
  if (minutes < 60) return `${minutes} min`;

  const hours = minutes / 60;
  return Number.isInteger(hours)
    ? `${hours} hr${hours === 1 ? "" : "s"}`
    : `${hours.toFixed(1)} hrs`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function humanAction(action: string) {
  const names: Record<string, string> = {
    updated_task: "Updated task",
    self_assigned: "Self-assigned",
    started_work: "Started work",
    blocked: "Blocked task",
    resumed_work: "Resumed work",
    submitted_for_review: "Submitted for review",
    approved: "Approved and completed",
    returned_for_changes: "Returned for changes",
    added_subtask: "Added subtask",
    updated_subtask: "Updated subtask",
    deleted_subtask: "Deleted subtask",
    logged_time: "Logged time",
  };

  return names[action] ?? titleCase(action);
}

export function TaskDetailModal({
  taskId,
  projects,
  categories,
  teamMembers,
  currentUser,
  onClose,
  onChanged,
}: Props) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("details");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "critical"
  >("normal");
  const [peopleNeeded, setPeopleNeeded] = useState("1");
  const [estimateHours, setEstimateHours] = useState("");
  const [deadline, setDeadline] = useState("");
  const [leadMemberId, setLeadMemberId] = useState("");
  const [pocMemberId, setPocMemberId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [evidenceType, setEvidenceType] = useState("");
  const [evidenceLocation, setEvidenceLocation] = useState("");

  const [blockReason, setBlockReason] = useState("");

  const [newSubtask, setNewSubtask] = useState("");

  const [logHours, setLogHours] = useState("");
  const [logDate, setLogDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [logNote, setLogNote] = useState("");

  const loadTask = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load task.");
      }

      const detail = payload.task as TaskDetail;
      setTask(detail);
      setTitle(detail.title);
      setDescription(detail.description ?? "");
      setProjectId(detail.project_id);
      setCategoryId(detail.category_id);
      setPriority(detail.priority);
      setPeopleNeeded(String(detail.people_needed));
      setEstimateHours(
        detail.estimated_minutes == null
          ? ""
          : String(detail.estimated_minutes / 60)
      );
      setDeadline(toDateInput(detail.deadline));
      setLeadMemberId(detail.lead_member_id ?? "");
      setPocMemberId(detail.poc_member_id ?? "");
      setAssigneeIds(detail.assignees.map((member) => member.member_id));
      setEvidenceRequired(detail.evidence_required);
      setEvidenceType(detail.evidence_type ?? "");
      setEvidenceLocation(detail.evidence_location ?? "");
      setBlockReason(detail.blocked_reason ?? "");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load task."
      );
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const isAssigned = Boolean(
    currentUser &&
      task?.assignees.some((member) => member.member_id === currentUser.id)
  );

  const hasOpenSlot = Boolean(
    task && task.assignees.length < task.people_needed
  );

  const canReview = Boolean(
    currentUser && reviewerRoles.has(currentUser.role)
  );

  const subtaskProgress = useMemo(() => {
    if (!task || task.subtasks.length === 0) return null;

    const done = task.subtasks.filter((item) => item.completed).length;
    return `${done} / ${task.subtasks.length}`;
  }, [task]);

  async function requestAction(
    action: string,
    data: Record<string, unknown> = {}
  ) {
    if (!currentUser) {
      setMessage("Select yourself under Working As before changing a task.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          actor_member_id: currentUser.id,
          ...data,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update task.");
      }

      await loadTask();
      await onChanged();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update task."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask() {
    if (!currentUser) {
      setMessage("Select yourself under Working As before deleting a task.");
      return;
    }

    if (!canReview) {
      setMessage(
        "Only a captain, mentor, or coach can permanently delete a task."
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${task?.title ?? "this task"}"?\n\n` +
        "This will also remove its live assignments, subtasks, planned hours, " +
        "actual time entries, and activity history.\n\n" +
        "Historical spreadsheet records are NOT affected."
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_member_id: currentUser.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete task.");
      }

      await onChanged();
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete task."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();

    const estimate = estimateHours
      ? Math.round(Number(estimateHours) * 60)
      : null;

    await requestAction("update_task", {
      title,
      description,
      project_id: projectId,
      category_id: categoryId,
      priority,
      people_needed: Number(peopleNeeded),
      estimated_minutes: estimate,
      deadline: deadline
        ? new Date(`${deadline}T23:59:00`).toISOString()
        : null,
      lead_member_id: leadMemberId || null,
      poc_member_id: pocMemberId || null,
      assignee_ids: assigneeIds,
      evidence_required: evidenceRequired,
      evidence_type: evidenceRequired ? evidenceType : null,
      evidence_location: evidenceRequired ? evidenceLocation : null,
    });
  }

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  }

  async function addSubtask(event: FormEvent) {
    event.preventDefault();

    const value = newSubtask.trim();
    if (!value) return;

    await requestAction("add_subtask", { subtask_title: value });
    setNewSubtask("");
  }

  async function logTime(event: FormEvent) {
    event.preventDefault();

    const hours = Number(logHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setMessage("Enter the amount of time worked.");
      return;
    }

    await requestAction("log_time", {
      minutes: Math.round(hours * 60),
      work_date: logDate,
      note: logNote,
    });

    setLogHours("");
    setLogNote("");
  }

  if (loading) {
    return (
      <div className={styles.overlay}>
        <section className={styles.modal}>
          <div className={styles.body}>
            <div className={styles.loading}>Loading task details…</div>
          </div>
        </section>
      </div>
    );
  }

  if (!task) {
    return (
      <div className={styles.overlay}>
        <section className={styles.modal}>
          <div className={styles.body}>
            <div className={styles.error}>
              {message || "Task details are unavailable."}
            </div>
            <div className={styles.workflow}>
              <button className={styles.actionSecondary} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-workflow-title"
      >
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              {task.category_name} · {task.project_name}
            </p>
            <h2 id="task-workflow-title">{task.title}</h2>
            <div className={styles.headerMeta}>
              <span
                className={`${styles.pill} ${
                  task.status === "blocked"
                    ? styles.blockedPill
                    : task.status === "completed"
                      ? styles.completedPill
                      : ""
                }`}
              >
                {titleCase(task.status)}
              </span>
              <span className={styles.pill}>
                {titleCase(task.priority)} Priority
              </span>
              {subtaskProgress && (
                <span className={styles.pill}>
                  Subtasks {subtaskProgress}
                </span>
              )}
              <span className={styles.pill}>
                Actual {formatMinutes(task.actual_minutes)}
              </span>
            </div>
          </div>

          <button
            className={styles.close}
            onClick={onClose}
            disabled={busy}
            aria-label="Close task"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          {!currentUser && (
            <div className={styles.notice}>
              Select yourself under <strong>Working As</strong> to edit,
              self-assign, change status, or log time.
            </div>
          )}

          {message && <div className={styles.error}>{message}</div>}

          <div className={styles.workflow}>
            {!isAssigned && hasOpenSlot && task.status !== "completed" && (
              <button
                className={styles.action}
                disabled={!currentUser || busy}
                onClick={() => requestAction("self_assign")}
              >
                + Self Assign
              </button>
            )}

            {(task.status === "assigned" ||
              task.status === "needs_assignment" ||
              task.status === "backlog") && (
              <button
                className={styles.action}
                disabled={!currentUser || !isAssigned || busy}
                title={
                  !isAssigned
                    ? "Assign yourself to the task before starting work."
                    : undefined
                }
                onClick={() => requestAction("start_work")}
              >
                Start Work
              </button>
            )}

            {task.status === "in_progress" && (
              <>
                <button
                  className={styles.actionApprove}
                  disabled={!currentUser || !isAssigned || busy}
                  onClick={() => requestAction("complete")}
                >
                  Mark Complete
                </button>

                <div className={styles.inlineAction}>
                  <input
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    placeholder="Why is this blocked?"
                  />
                  <button
                    className={styles.actionDanger}
                    disabled={!currentUser || !isAssigned || busy}
                    onClick={() =>
                      requestAction("block", {
                        blocked_reason: blockReason,
                      })
                    }
                  >
                    Mark Blocked
                  </button>
                </div>
              </>
            )}

            {task.status === "blocked" && (
              <>
                <div className={styles.notice}>
                  <strong>Blocked:</strong>{" "}
                  {task.blocked_reason || "No reason recorded."}
                </div>
                <button
                  className={styles.action}
                  disabled={!currentUser || !isAssigned || busy}
                  onClick={() => requestAction("resume_work")}
                >
                  Resume Work
                </button>
              </>
            )}

            {task.status === "completed" && (
              <div className={styles.notice}>
                Completed
                {task.approved_by_name ? (
                  <>
                    {" "}by <strong>{task.approved_by_name}</strong>
                  </>
                ) : null}
                {task.completed_at
                  ? ` on ${formatDate(task.completed_at)}`
                  : ""}
                .
              </div>
            )}
          </div>

          <div className={styles.tabs}>
            {(["details", "subtasks", "time", "activity"] as Tab[]).map(
              (value) => (
                <button
                  type="button"
                  key={value}
                  className={tab === value ? styles.activeTab : undefined}
                  onClick={() => setTab(value)}
                >
                  {value === "time" ? "Actual Time" : titleCase(value)}
                </button>
              )
            )}
          </div>

          {tab === "details" && (
            <form onSubmit={saveDetails}>
              <section className={styles.section}>
                <h3>Task Definition</h3>

                <div className={styles.formGrid2}>
                  <label className={styles.field}>
                    Task Name
                    <input
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    Project
                    <select
                      required
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className={styles.field} style={{ marginTop: 12 }}>
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What specifically needs to be accomplished?"
                  />
                </label>

                <div className={styles.formGrid4} style={{ marginTop: 12 }}>
                  <label className={styles.field}>
                    Category
                    <select
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    Priority
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(
                          event.target.value as
                            | "low"
                            | "normal"
                            | "high"
                            | "critical"
                        )
                      }
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>

                  

                  <label className={styles.field}>
                    Deadline
                    <input
                      type="date"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className={styles.section}>
                <h3>People & Effort</h3>

                <div className={styles.formGrid4}>
                  <label className={styles.field}>
                    People Needed
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={peopleNeeded}
                      onChange={(event) => setPeopleNeeded(event.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    Estimated Hours
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={estimateHours}
                      onChange={(event) => setEstimateHours(event.target.value)}
                      placeholder="e.g. 2.5"
                    />
                  </label>

                  <label className={styles.field}>
                    Task Lead
                    <select
                      value={leadMemberId}
                      onChange={(event) => {
                        const next = event.target.value;
                        setLeadMemberId(next);
                        if (next && !assigneeIds.includes(next)) {
                          setAssigneeIds((current) => [...current, next]);
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} · {titleCase(member.role)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    Point of Contact
                    <select
                      value={pocMemberId}
                      onChange={(event) => setPocMemberId(event.target.value)}
                    >
                      <option value="">None</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={styles.assigneeGrid}>
                  {teamMembers.map((member) => (
                    <label className={styles.assignee} key={member.id}>
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(member.id)}
                        onChange={() => toggleAssignee(member.id)}
                      />
                      {member.name}
                    </label>
                  ))}
                </div>

                <p className={styles.help}>
                  The task lead is always included as an assignee. If assigned
                  people exceed People Needed, increase People Needed before
                  saving.
                </p>
              </section>

              <section className={styles.section}>
                <h3>Evidence</h3>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={evidenceRequired}
                    onChange={(event) =>
                      setEvidenceRequired(event.target.checked)
                    }
                  />
                  Evidence is required for this task
                </label>

                {evidenceRequired && (
                  <div className={styles.formGrid2} style={{ marginTop: 12 }}>
                    <label className={styles.field}>
                      Evidence Type
                      <select
                        value={evidenceType}
                        onChange={(event) => setEvidenceType(event.target.value)}
                      >
                        <option value="">Select type</option>
                        <option value="CAD">CAD</option>
                        <option value="GitHub">GitHub</option>
                        <option value="Google Doc">Google Doc</option>
                        <option value="Notion">Notion</option>
                        <option value="Photo / Video">Photo / Video</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      Evidence Location
                      <input
                        value={evidenceLocation}
                        onChange={(event) =>
                          setEvidenceLocation(event.target.value)
                        }
                        placeholder="URL, document name, folder, etc."
                      />
                    </label>
                  </div>
                )}
              </section>

              {task.review_notes && (
                <div className={styles.reviewBox}>
                  <strong>Latest Review Note</strong>
                  <p>{task.review_notes}</p>
                </div>
              )}

              <div className={styles.saveBar}>
                <div className={styles.saveBarLeft}>
                  {canReview && (
                    <button
                      className={styles.deleteTask}
                      type="button"
                      disabled={busy}
                      onClick={deleteTask}
                    >
                      Delete Task
                    </button>
                  )}
                </div>

                <button
                  className={styles.save}
                  type="submit"
                  disabled={!currentUser || busy}
                >
                  {busy ? "Working…" : "Save Task"}
                </button>
              </div>
            </form>
          )}

          {tab === "subtasks" && (
            <>
              <section className={styles.section}>
                <h3>Subtasks</h3>

                <form className={styles.inlineAction} onSubmit={addSubtask}>
                  <input
                    value={newSubtask}
                    onChange={(event) => setNewSubtask(event.target.value)}
                    placeholder="Add a smaller checklist item…"
                  />
                  <button
                    className={styles.action}
                    disabled={!currentUser || busy || !newSubtask.trim()}
                  >
                    + Add
                  </button>
                </form>
              </section>

              <div className={styles.subtaskList}>
                {task.subtasks.length === 0 && (
                  <div className={styles.notice}>
                    No subtasks have been added.
                  </div>
                )}

                {task.subtasks.map((subtask) => (
                  <div className={styles.subtaskRow} key={subtask.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        disabled={!currentUser || busy}
                        onChange={(event) =>
                          requestAction("toggle_subtask", {
                            subtask_id: subtask.id,
                            completed: event.target.checked,
                          })
                        }
                      />
                      <span
                        className={
                          subtask.completed ? styles.subtaskDone : undefined
                        }
                      >
                        {subtask.title}
                      </span>
                    </label>

                    <span></span>

                    <button
                      className={styles.iconButton}
                      disabled={!currentUser || busy}
                      onClick={() =>
                        requestAction("delete_subtask", {
                          subtask_id: subtask.id,
                        })
                      }
                      aria-label={`Delete ${subtask.title}`}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "time" && (
            <>
              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <span>Task Estimate</span>
                  <strong>{formatMinutes(task.estimated_minutes)}</strong>
                </div>
                <div className={styles.summaryItem}>
                  <span>Actual Logged</span>
                  <strong>{formatMinutes(task.actual_minutes)}</strong>
                </div>
                <div className={styles.summaryItem}>
                  <span>Variance</span>
                  <strong>
                    {task.estimated_minutes == null
                      ? "—"
                      : formatMinutes(task.actual_minutes - task.estimated_minutes)}
                  </strong>
                </div>
              </div>

              <section className={styles.section}>
                <h3>Log Actual Time</h3>

                <form onSubmit={logTime}>
                  <div className={styles.formGrid3}>
                    <label className={styles.field}>
                      Hours Worked
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={logHours}
                        onChange={(event) => setLogHours(event.target.value)}
                        placeholder="e.g. 1.5"
                      />
                    </label>

                    <label className={styles.field}>
                      Date
                      <input
                        type="date"
                        value={logDate}
                        onChange={(event) => setLogDate(event.target.value)}
                      />
                    </label>

                    <label className={styles.field}>
                      Note
                      <input
                        value={logNote}
                        onChange={(event) => setLogNote(event.target.value)}
                        placeholder="What did you work on?"
                      />
                    </label>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <button
                      className={styles.action}
                      disabled={!currentUser || busy || !logHours}
                    >
                      Log Time
                    </button>
                  </div>
                </form>
              </section>

              <section className={styles.section}>
                <h3>Time History</h3>

                <div className={styles.timeList}>
                  {task.time_entries.length === 0 && (
                    <div className={styles.notice}>
                      No actual time has been logged yet.
                    </div>
                  )}

                  {task.time_entries.map((entry) => (
                    <div className={styles.timeRow} key={entry.id}>
                      <div className={styles.timeWho}>
                        {entry.member_name}
                        <div className={styles.timeNote}>
                          {formatDate(entry.work_date)}
                        </div>
                      </div>

                      <div className={styles.timeNote}>
                        {entry.note || "No note"}
                      </div>

                      <div className={styles.timeAmount}>
                        {formatMinutes(entry.minutes)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "activity" && (
            <section className={styles.section}>
              <h3>Task History</h3>

              <div className={styles.activityList}>
                {task.activity.length === 0 && (
                  <div className={styles.notice}>
                    No task activity has been recorded yet.
                  </div>
                )}

                {task.activity.map((entry) => (
                  <div className={styles.activityRow} key={entry.id}>
                    <div className={styles.activityWho}>
                      {entry.actor_name}
                      <div className={styles.activityNote}>
                        {formatDate(entry.created_at)}
                      </div>
                    </div>

                    <div className={styles.activityNote}>
                      {humanAction(entry.action)}
                    </div>

                    <span></span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
