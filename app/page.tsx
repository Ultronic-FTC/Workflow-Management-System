"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Metric } from "@/components/ui";
import { useCurrentUser } from "@/components/current-user-provider";
import { TaskDetailModal } from "@/components/task-detail-modal";
import styles from "./team-board.module.css";

type TaskStatus =
  | "backlog"
  | "needs_assignment"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "completed";

type Task = {
  id: string;
  project_id: string;
  project_name: string;
  project_division: "technical" | "operational" | "both";
  category_id: string;
  category_name: string;
  category_division: "technical" | "operational";
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "critical";
  difficulty: number | null;
  people_needed: number;
  estimated_minutes: number | null;
  deadline: string | null;
  lead_member_id: string | null;
  lead_name: string | null;
  poc_member_id: string | null;
  poc_name: string | null;
  assignee_ids: string[];
  assignee_names: string[];
  assigned_count: number;
};

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

type CapacitySummary = {
  available_minutes: number;
  planned_minutes: number;
  remaining_minutes: number;
  over_capacity_count: number;
};

const boardColumns: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "needs_assignment", label: "Needs Assignment" },
  { status: "assigned", label: "Assigned" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "ready_for_review", label: "Ready for Review" },
];

function formatDeadline(value: string | null) {
  if (!value) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatEstimate(minutes: number | null) {
  if (minutes == null) {
    return "No estimate";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr${hours === 1 ? "" : "s"}` : `${hours.toFixed(1)} hrs`;
}

function isOverdue(task: Task) {
  if (!task.deadline || task.status === "completed") {
    return false;
  }

  return new Date(task.deadline).getTime() < Date.now();
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function currentWeekStart() {
  const date = new Date();
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function capacityHours(minutes: number) {
  const value = minutes / 60;
  return Number.isInteger(value) ? `${value} hrs` : `${value.toFixed(1)} hrs`;
}

export default function TeamBoardPage() {
  const { currentUser, teamMembers, hydrated } = useCurrentUser();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [capacitySummary, setCapacitySummary] = useState<CapacitySummary>({
    available_minutes: 0,
    planned_minutes: 0,
    remaining_minutes: 0,
    over_capacity_count: 0,
  });
  const [historicalCompletedCount, setHistoricalCompletedCount] = useState(0);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [needsPeopleOnly, setNeedsPeopleOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "critical"
  >("normal");
  const [difficulty, setDifficulty] = useState("");
  const [peopleNeeded, setPeopleNeeded] = useState("1");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [leadMemberId, setLeadMemberId] = useState("");
  const [pocMemberId, setPocMemberId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [taskResponse, capacityResponse, historyResponse] =
        await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch(`/api/capacity?week_start=${currentWeekStart()}`, {
            cache: "no-store",
          }),
          fetch("/api/historical-work/summary", { cache: "no-store" }),
        ]);

      const taskPayload = await taskResponse.json();
      const capacityPayload = await capacityResponse.json();
      const historyPayload = await historyResponse.json();

      if (!taskResponse.ok) {
        throw new Error(taskPayload.error ?? "Unable to load team board.");
      }

      setTasks(Array.isArray(taskPayload.tasks) ? taskPayload.tasks : []);
      setProjects(Array.isArray(taskPayload.projects) ? taskPayload.projects : []);
      setCategories(Array.isArray(taskPayload.categories) ? taskPayload.categories : []);

      if (capacityResponse.ok && capacityPayload.summary) {
        setCapacitySummary({
          available_minutes: capacityPayload.summary.available_minutes ?? 0,
          planned_minutes: capacityPayload.summary.planned_minutes ?? 0,
          remaining_minutes: capacityPayload.summary.remaining_minutes ?? 0,
          over_capacity_count: capacityPayload.summary.over_capacity_count ?? 0,
        });
      }

      if (historyResponse.ok) {
        setHistoricalCompletedCount(
          Number(historyPayload.historical_completed_count ?? 0)
        );
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load team board."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    function handleNewTask() {
      openNewTask();
    }

    window.addEventListener("ultronic:new-task", handleNewTask);

    return () => {
      window.removeEventListener("ultronic:new-task", handleNewTask);
    };
  });

  function openNewTask(defaultStatus?: TaskStatus) {
    setTitle("");
    setDescription("");
    setProjectId("");
    setCategoryId("");
    setPriority("normal");
    setDifficulty("");
    setPeopleNeeded("1");
    setEstimatedMinutes("");
    setDeadline("");
    setLeadMemberId(currentUser?.id ?? "");
    setPocMemberId(currentUser?.id ?? "");
    setAssigneeIds(currentUser?.id ? [currentUser.id] : []);
    setFormError("");
    setShowModal(true);
  }

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  }

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          project_id: projectId,
          category_id: categoryId,
          priority,
          difficulty: difficulty ? Number(difficulty) : null,
          people_needed: Number(peopleNeeded),
          estimated_minutes: estimatedMinutes
            ? Number(estimatedMinutes)
            : null,
          deadline: deadline
            ? new Date(`${deadline}T23:59:00`).toISOString()
            : null,
          lead_member_id: leadMemberId || null,
          poc_member_id: pocMemberId || null,
          assignee_ids: assigneeIds,
          created_by_member_id: currentUser?.id ?? null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create task.");
      }

      setShowModal(false);
      await loadBoard();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create task."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (categoryFilter && task.category_id !== categoryFilter) return false;
      if (projectFilter && task.project_id !== projectFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;

      if (
        personFilter &&
        task.lead_member_id !== personFilter &&
        !task.assignee_ids.includes(personFilter)
      ) {
        return false;
      }

      if (
        myTasksOnly &&
        currentUser &&
        task.lead_member_id !== currentUser.id &&
        !task.assignee_ids.includes(currentUser.id)
      ) {
        return false;
      }

      if (needsPeopleOnly && task.assigned_count >= task.people_needed) {
        return false;
      }

      if (overdueOnly && !isOverdue(task)) return false;
      if (blockedOnly && task.status !== "blocked") return false;

      if (deadlineFilter === "overdue" && !isOverdue(task)) return false;
      if (deadlineFilter === "none" && task.deadline) return false;

      if (deadlineFilter === "7days") {
        if (!task.deadline) return false;
        const due = new Date(task.deadline).getTime();
        const now = Date.now();
        const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
        if (due < now || due > sevenDays) return false;
      }

      return true;
    });
  }, [
    tasks,
    categoryFilter,
    projectFilter,
    personFilter,
    priorityFilter,
    deadlineFilter,
    myTasksOnly,
    needsPeopleOnly,
    overdueOnly,
    blockedOnly,
    currentUser,
  ]);

  const metrics = useMemo(() => {
    return {
      overdue: tasks.filter(isOverdue).length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      needPeople: tasks.filter(
        (task) =>
          task.status !== "completed" &&
          task.assigned_count < task.people_needed
      ).length,
      review: tasks.filter(
        (task) => task.status === "ready_for_review"
      ).length,
      completed:
        tasks.filter((task) => task.status === "completed").length +
        historicalCompletedCount,
    };
  }, [tasks, historicalCompletedCount]);

  const hasFilters =
    Boolean(categoryFilter) ||
    Boolean(projectFilter) ||
    Boolean(personFilter) ||
    Boolean(priorityFilter) ||
    Boolean(deadlineFilter) ||
    myTasksOnly ||
    needsPeopleOnly ||
    overdueOnly ||
    blockedOnly;

  function clearFilters() {
    setCategoryFilter("");
    setProjectFilter("");
    setPersonFilter("");
    setPriorityFilter("");
    setDeadlineFilter("");
    setMyTasksOnly(false);
    setNeedsPeopleOnly(false);
    setOverdueOnly(false);
    setBlockedOnly(false);
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TEAM OPERATIONS</p>
          <h1>Team Board</h1>
          <p>Everything the team is working on, in one place.</p>
        </div>
        <button
          className={`primary-button ${styles.pageNewTask}`}
          onClick={() => openNewTask()}
        >
          + New Task
        </button>
      </div>

      {hydrated && !currentUser && (
        <div className="identity-prompt">
          <strong>Choose your name above.</strong>
          <span>
            My Tasks includes anything you lead or are assigned to.
          </span>
        </div>
      )}

      <section className="metrics-grid">
        <Metric value={metrics.overdue} label="Overdue" tone="red" />
        <Metric value={metrics.blocked} label="Blocked" tone="red" />
        <Metric value={metrics.needPeople} label="Need People" tone="yellow" />
        <Metric value={metrics.review} label="Need Review" tone="cyan" />
        <Metric value={metrics.completed} label="Completed" tone="neutral" />
        <div className="capacity-card">
          <div>
            <small>TEAM CAPACITY · THIS WEEK</small>
            <strong>{capacityHours(capacitySummary.available_minutes)}</strong>
            <span>available</span>
          </div>
          <div>
            <strong>{capacityHours(capacitySummary.planned_minutes)}</strong>
            <span>planned</span>
          </div>
          <div>
            <strong>{capacityHours(capacitySummary.remaining_minutes)}</strong>
            <span>remaining{capacitySummary.over_capacity_count > 0 ? ` · ${capacitySummary.over_capacity_count} over` : ""}</span>
          </div>
        </div>
      </section>

      <section className="filterbar">
        <select
          className={styles.filterSelect}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={personFilter}
          onChange={(event) => setPersonFilter(event.target.value)}
        >
          <option value="">All People</option>
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <select
          className={styles.filterSelect}
          value={deadlineFilter}
          onChange={(event) => setDeadlineFilter(event.target.value)}
        >
          <option value="">All Deadlines</option>
          <option value="7days">Due in 7 days</option>
          <option value="overdue">Overdue</option>
          <option value="none">No deadline</option>
        </select>

        <button
          className={myTasksOnly ? "active-filter" : undefined}
          disabled={!currentUser}
          onClick={() => setMyTasksOnly((current) => !current)}
        >
          My Tasks
        </button>

        <button
          className={needsPeopleOnly ? "active-filter" : undefined}
          onClick={() => setNeedsPeopleOnly((current) => !current)}
        >
          Needs People
        </button>

        <button
          className={overdueOnly ? "active-filter" : undefined}
          onClick={() => setOverdueOnly((current) => !current)}
        >
          Overdue
        </button>

        <button
          className={blockedOnly ? "active-filter" : undefined}
          onClick={() => setBlockedOnly((current) => !current)}
        >
          Blocked
        </button>

        {hasFilters && (
          <button className={styles.clearFilters} onClick={clearFilters}>
            Clear
          </button>
        )}
      </section>

      {loading && <div className={styles.loading}>Loading real team tasks…</div>}

      {!loading && loadError && (
        <div className={styles.error}>
          <strong>The Team Board could not be loaded.</strong>
          <div>{loadError}</div>
        </div>
      )}

      {!loading && !loadError && tasks.length === 0 && (
        <div className={styles.emptyBoard}>
          There are no tasks yet. Click <strong>+ New Task</strong> to create
          the first one.
        </div>
      )}

      {!loading && !loadError && (
        <section
          className="kanban"
          style={{
            gridTemplateColumns: "repeat(6, minmax(235px, 1fr))",
          }}
        >
          {boardColumns.map((column) => {
            const columnTasks = filteredTasks.filter(
              (task) => task.status === column.status
            );

            return (
              <div className="kanban-column" key={column.status}>
                <div className="column-title">
                  <h2>{column.label}</h2>
                  <span>{columnTasks.length}</span>
                </div>

                {columnTasks.map((task) => {
                  const overdue = isOverdue(task);
                  const operational =
                    task.category_division === "operational";

                  return (
                    <article
                      className={`${styles.taskCard} ${
                        operational ? styles.operational : ""
                      }`}
                      key={task.id}
                      title={task.description ?? "Open task details"}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedTask(task)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTask(task);
                        }
                      }}
                    >
                      <h3 className={styles.taskTitle}>{task.title}</h3>

                      <div className={styles.taskMeta}>
                        <span>Lead: {task.lead_name ?? "Unassigned"}</span>
                        <span>
                          👥 {task.assigned_count} / {task.people_needed}
                        </span>
                      </div>

                      <div className={styles.taskFooter}>
                        <span
                          className={
                            overdue ? styles.dueOverdue : styles.dueDate
                          }
                        >
                          Due: {formatDeadline(task.deadline)}
                        </span>
                      </div>
                    </article>
                  );
                })}

                {columnTasks.length === 0 && (
                  <p className="empty-column">No matching tasks.</p>
                )}

                {column.status !== "completed" && (
                  <button className="add-task" onClick={() => openNewTask()}>
                    + Add task
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {selectedTask && (
        <TaskDetailModal
          taskId={selectedTask.id}
          projects={projects}
          categories={categories}
          teamMembers={teamMembers}
          currentUser={currentUser}
          onClose={() => setSelectedTask(null)}
          onChanged={loadBoard}
        />
      )}

      {showModal && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !submitting) {
              setShowModal(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className="eyebrow">NEW WORK</p>
                <h2 id="new-task-title">Create Task</h2>
              </div>
              <button
                className={styles.close}
                onClick={() => setShowModal(false)}
                disabled={submitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className={styles.form} onSubmit={submitTask}>
              <label>
                Task Name
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Contact Gene Griffin to confirm demo date"
                />
              </label>

              <div className={styles.twoCol}>
                <label>
                  Project
                  <select
                    required
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    <option value="">Select project</option>
                    {projects
                      .filter((project) => project.status !== "completed")
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Category
                  <select
                    required
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.full}>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What specifically needs to be accomplished?"
                />
              </label>

              <div className={styles.fourCol}>
                <label>
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

                <label>
                  Difficulty
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                  >
                    <option value="">Not set</option>
                    <option value="1">1 · Very Easy</option>
                    <option value="2">2 · Easy</option>
                    <option value="3">3 · Moderate</option>
                    <option value="4">4 · Difficult</option>
                    <option value="5">5 · Advanced</option>
                  </select>
                </label>

                <label>
                  People Needed
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={peopleNeeded}
                    onChange={(event) => setPeopleNeeded(event.target.value)}
                  />
                </label>

                <label>
                  Estimate
                  <select
                    value={estimatedMinutes}
                    onChange={(event) => setEstimatedMinutes(event.target.value)}
                  >
                    <option value="">Not set</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                    <option value="240">4 hours</option>
                    <option value="360">6 hours</option>
                    <option value="480">8 hours</option>
                  </select>
                </label>
              </div>

              <div className={styles.twoCol}>
                <label>
                  Deadline
                  <input
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                </label>

                <label>
                  Task Lead
                  <select
                    value={leadMemberId}
                    onChange={(event) => {
                      const nextLead = event.target.value;
                      setLeadMemberId(nextLead);
                      if (
                        nextLead &&
                        !assigneeIds.includes(nextLead)
                      ) {
                        setAssigneeIds((current) => [...current, nextLead]);
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
              </div>

              <div className={styles.twoCol}>
                <label>
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

                <label>
                  Created By
                  <input
                    value={currentUser?.name ?? "Select yourself above"}
                    disabled
                  />
                </label>
              </div>

              <fieldset className={styles.assignees}>
                <legend>Assigned Team Members</legend>
                <p className={styles.help}>
                  The Task Lead is automatically included. Select additional
                  people now, or leave open spots so students can self-assign
                  later.
                </p>
                <div className={styles.assigneeGrid}>
                  {teamMembers.map((member) => (
                    <label key={member.id}>
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(member.id)}
                        onChange={() => toggleAssignee(member.id)}
                      />
                      {member.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              {formError && (
                <p className={styles.formMessage}>{formError}</p>
              )}

              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.submit}
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create Task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
