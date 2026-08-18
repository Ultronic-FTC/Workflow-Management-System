"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { useCurrentUser } from "@/components/current-user-provider";
import {
  HistoricalWorkModal,
  type HistoricalEventDetail,
} from "@/components/historical-work-modal";
import styles from "./operational-calendar.module.css";

type TaskStatus =
  | "backlog"
  | "needs_assignment"
  | "assigned"
  | "in_progress"
  | "blocked"
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
  deadline: string | null;
  lead_member_id: string | null;
  lead_name: string | null;
  assignee_ids: string[];
  assignee_names: string[];
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  division: "technical" | "operational" | "both";
  status: string;
  target_date?: string | null;
};

type Category = {
  id: string;
  name: string;
  division: "technical" | "operational";
  sort_order: number;
};

type HistoricalRow = {
  id: string;
  source_row: number;
  member_id: string;
  member_name: string;
  member_active: boolean;
  work_date: string;
  category_name: string;
  project_name: string;
  task_name: string;
  minutes: number;
  hours: number;
  work_type: string | null;
  description: string | null;
};

type CalendarEvent =
  | {
      key: string;
      dateKey: string;
      type: "task";
      title: string;
      taskId: string;
      projectName: string;
      leadName: string | null;
      status: TaskStatus;
      priority: Task["priority"];
    }
  | {
      key: string;
      dateKey: string;
      type: "project";
      title: string;
      projectName: string;
    }
  | {
      key: string;
      dateKey: string;
      type: "competition";
      title: string;
    }
  | {
      key: string;
      dateKey: string;
      type: "historical";
      title: string;
      projectName: string;
      totalHours: number;
      participantCount: number;
      detail: HistoricalEventDetail;
    };

const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function dateKeyFromValue(value: string | null | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function makeDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(dateFromKey(value));
}

function isOperationalTask(task: Task) {
  return (
    task.category_division === "operational" ||
    task.project_division === "operational" ||
    task.project_division === "both"
  );
}

function statusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    backlog: "Backlog",
    needs_assignment: "Needs Assignment",
    assigned: "Assigned",
    in_progress: "In Progress",
    blocked: "Blocked",
    ready_for_review: "Ready for Review",
    completed: "Completed",
  };

  return labels[status];
}

export default function OperationalCalendarPage() {
  const { currentUser, teamMembers } = useCurrentUser();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskProjects, setTaskProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [competitionDate, setCompetitionDate] = useState<string | null>(null);
  const [historicalRows, setHistoricalRows] = useState<HistoricalRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] =
    useState<HistoricalEventDetail | null>(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
  });

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [
        taskResponse,
        projectResponse,
        competitionResponse,
        historicalResponse,
      ] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/settings/competition-date", { cache: "no-store" }),
        fetch("/api/historical-work", { cache: "no-store" }),
      ]);

      const taskPayload = await taskResponse.json();
      const projectPayload = await projectResponse.json();
      const competitionPayload = await competitionResponse.json();
      const historicalPayload = await historicalResponse.json();

      if (!taskResponse.ok) {
        throw new Error(taskPayload.error ?? "Unable to load tasks.");
      }

      if (!projectResponse.ok) {
        throw new Error(projectPayload.error ?? "Unable to load projects.");
      }

      if (!competitionResponse.ok) {
        throw new Error(
          competitionPayload.error ?? "Unable to load competition date."
        );
      }

      if (!historicalResponse.ok) {
        throw new Error(
          historicalPayload.error ?? "Unable to load historical work."
        );
      }

      setTasks(Array.isArray(taskPayload.tasks) ? taskPayload.tasks : []);
      setTaskProjects(
        Array.isArray(taskPayload.projects) ? taskPayload.projects : []
      );
      setCategories(
        Array.isArray(taskPayload.categories) ? taskPayload.categories : []
      );
      setProjects(
        Array.isArray(projectPayload.projects) ? projectPayload.projects : []
      );
      setCompetitionDate(competitionPayload.next_competition_date ?? null);
      setHistoricalRows(
        Array.isArray(historicalPayload.history)
          ? historicalPayload.history
          : []
      );
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to load calendar."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const operationalTasks = useMemo(
    () => tasks.filter(isOperationalTask),
    [tasks]
  );

  const events = useMemo(() => {
    const nextEvents: CalendarEvent[] = [];

    for (const task of operationalTasks) {
      const dateKey = dateKeyFromValue(task.deadline);
      if (!dateKey) continue;

      nextEvents.push({
        key: `task-${task.id}`,
        dateKey,
        type: "task",
        title: task.title,
        taskId: task.id,
        projectName: task.project_name,
        leadName: task.lead_name,
        status: task.status,
        priority: task.priority,
      });
    }

    for (const project of projects) {
      if (
        project.division !== "operational" &&
        project.division !== "both"
      ) {
        continue;
      }

      const dateKey = dateKeyFromValue(project.target_date);
      if (!dateKey) continue;

      nextEvents.push({
        key: `project-${project.id}`,
        dateKey,
        type: "project",
        title: `${project.name} target`,
        projectName: project.name,
      });
    }

    const competitionKey = dateKeyFromValue(competitionDate);
    if (competitionKey) {
      nextEvents.push({
        key: `competition-${competitionKey}`,
        dateKey: competitionKey,
        type: "competition",
        title: "Next Competition",
      });
    }

    const historicalGroups = new Map<string, HistoricalRow[]>();

    for (const row of historicalRows) {
      const dateKey = dateKeyFromValue(row.work_date);
      if (!dateKey) continue;

      const groupKey = [
        dateKey,
        row.category_name,
        row.project_name,
        row.task_name,
        row.work_type ?? "",
        row.description ?? "",
      ].join("||");

      const current = historicalGroups.get(groupKey) ?? [];
      current.push(row);
      historicalGroups.set(groupKey, current);
    }

    for (const [groupKey, rows] of historicalGroups) {
      const first = rows[0];
      const dateKey = dateKeyFromValue(first.work_date);
      if (!dateKey) continue;

      const participantMap = new Map<
        string,
        { name: string; hours: number; active: boolean }
      >();

      for (const row of rows) {
        const current = participantMap.get(row.member_name) ?? {
          name: row.member_name,
          hours: 0,
          active: row.member_active,
        };

        current.hours += Number(row.hours || 0);
        participantMap.set(row.member_name, current);
      }

      const participants = [...participantMap.values()];
      const totalHours = participants.reduce(
        (sum, participant) => sum + participant.hours,
        0
      );

      const detail: HistoricalEventDetail = {
        dateKey,
        category: first.category_name,
        project: first.project_name,
        task: first.task_name,
        workType: first.work_type,
        description: first.description,
        totalHours,
        participants,
      };

      nextEvents.push({
        key: `historical-${groupKey}`,
        dateKey,
        type: "historical",
        title: first.task_name,
        projectName: first.project_name,
        totalHours,
        participantCount: participants.length,
        detail,
      });
    }

    return nextEvents;
  }, [operationalTasks, projects, competitionDate, historicalRows]);

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const current = map.get(event.dateKey) ?? [];
      current.push(event);
      map.set(event.dateKey, current);
    }

    for (const dayEvents of map.values()) {
      dayEvents.sort((a, b) => {
        const eventRank = (event: CalendarEvent) => {
          if (event.type === "competition") return 0;
          if (event.type === "project") return 1;
          if (event.type === "historical") return 8;

          if (event.status === "blocked") return 2;
          if (event.priority === "critical") return 4;
          if (event.priority === "high") return 5;
          if (event.status === "completed") return 9;
          return 6;
        };

        const rankDifference = eventRank(a) - eventRank(b);
        if (rankDifference !== 0) return rankDifference;

        return a.title.localeCompare(b.title);
      });
    }

    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      1,
      12,
      0,
      0
    );

    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [monthCursor]);

  const todayKey = makeDateKey(new Date());
  const monthPrefix = `${monthCursor.getFullYear()}-${String(
    monthCursor.getMonth() + 1
  ).padStart(2, "0")}`;

  const summary = useMemo(() => {
    const openOperationalTasks = operationalTasks.filter(
      (task) => task.status !== "completed"
    );

    const dueThisMonth = openOperationalTasks.filter((task) => {
      const dateKey = dateKeyFromValue(task.deadline);
      return Boolean(dateKey?.startsWith(monthPrefix));
    }).length;

    const overdue = openOperationalTasks.filter((task) => {
      const dateKey = dateKeyFromValue(task.deadline);
      return Boolean(dateKey && dateKey < todayKey);
    }).length;

    const unscheduled = openOperationalTasks.filter(
      (task) => !dateKeyFromValue(task.deadline)
    ).length;

    const projectTargets = projects.filter((project) => {
      if (
        project.division !== "operational" &&
        project.division !== "both"
      ) {
        return false;
      }

      const dateKey = dateKeyFromValue(project.target_date);
      return Boolean(dateKey?.startsWith(monthPrefix));
    }).length;

    const historyThisMonth = historicalRows.filter((row) => {
      const dateKey = dateKeyFromValue(row.work_date);
      return Boolean(dateKey?.startsWith(monthPrefix));
    });

    const historicalHours = historyThisMonth.reduce(
      (sum, row) => sum + Number(row.hours || 0),
      0
    );

    return {
      dueThisMonth,
      overdue,
      unscheduled,
      projectTargets,
      historicalHours,
    };
  }, [
    operationalTasks,
    projects,
    historicalRows,
    monthPrefix,
    todayKey,
  ]);

  const unscheduledTasks = useMemo(
    () =>
      operationalTasks
        .filter(
          (task) =>
            task.status !== "completed" &&
            !dateKeyFromValue(task.deadline)
        )
        .sort((a, b) => a.project_name.localeCompare(b.project_name)),
    [operationalTasks]
  );

  function moveMonth(offset: number) {
    setMonthCursor(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1,
          12,
          0,
          0
        )
    );
  }

  function goToday() {
    const now = new Date();
    setMonthCursor(
      new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
    );
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TEAM OPERATIONS</p>
          <h1>Operational Calendar</h1>
          <p>
            Task deadlines, operational project milestones, and competition
            dates in one place.
          </p>
        </div>

        <div className={styles.monthControls}>
          <button
            type="button"
            className="ghost-button"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={goToday}
          >
            Today
          </button>

          <div className={styles.monthName}>{monthLabel(monthCursor)}</div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <strong>{summary.dueThisMonth}</strong>
          <span>Tasks Due This Month</span>
        </div>

        <div
          className={`${styles.summaryCard} ${
            summary.overdue > 0 ? styles.warningCard : ""
          }`}
        >
          <strong>{summary.overdue}</strong>
          <span>Overdue</span>
        </div>

        <div className={styles.summaryCard}>
          <strong>{summary.projectTargets}</strong>
          <span>Project Targets</span>
        </div>

        <div className={styles.summaryCard}>
          <strong>{summary.unscheduled}</strong>
          <span>Unscheduled Tasks</span>
        </div>

        <div className={`${styles.summaryCard} ${styles.historySummaryCard}`}>
          <strong>
            {Number.isInteger(summary.historicalHours)
              ? summary.historicalHours
              : summary.historicalHours.toFixed(1)}
          </strong>
          <span>Historical Hours This Month</span>
        </div>
      </div>

      <div className={styles.legend}>
        <span>
          <i className={styles.taskLegend} /> Task Deadline
        </span>
        <span>
          <i className={styles.projectLegend} /> Project Target
        </span>
        <span>
          <i className={styles.competitionLegend} /> Competition
        </span>
        <span>
          <i className={styles.blockedLegend} /> Blocked
        </span>
        <span>
          <i className={styles.historyLegend} /> Historical Work
        </span>
      </div>

      {pageError && <div className={styles.errorBox}>{pageError}</div>}

      {loading ? (
        <div className={styles.loadingBox}>Loading operational calendar…</div>
      ) : (
        <section className={styles.calendarShell}>
          <div className={styles.weekdays}>
            {weekdays.map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {calendarDays.map((date) => {
              const dateKey = makeDateKey(date);
              const dayEvents = eventMap.get(dateKey) ?? [];
              const outsideMonth =
                date.getMonth() !== monthCursor.getMonth();
              const isToday = dateKey === todayKey;

              return (
                <div
                  className={`${styles.dayCell} ${
                    outsideMonth ? styles.outsideMonth : ""
                  } ${isToday ? styles.today : ""}`}
                  key={dateKey}
                >
                  <div className={styles.dayHeader}>
                    <span>{date.getDate()}</span>
                    {isToday && <strong>TODAY</strong>}
                  </div>

                  <div className={styles.dayEvents}>
                    {dayEvents.map((event) => {
                      if (event.type === "competition") {
                        return (
                          <div
                            className={styles.competitionEvent}
                            key={event.key}
                          >
                            <span>COMPETITION</span>
                            <strong>{event.title}</strong>
                          </div>
                        );
                      }

                      if (event.type === "project") {
                        return (
                          <div
                            className={styles.projectEvent}
                            key={event.key}
                            title={`${event.projectName} project target`}
                          >
                            <span>PROJECT TARGET</span>
                            <strong>{event.projectName}</strong>
                          </div>
                        );
                      }

                      if (event.type === "historical") {
                        return (
                          <button
                            type="button"
                            className={styles.historicalEvent}
                            key={event.key}
                            onClick={() => setSelectedHistory(event.detail)}
                            title={`${event.title} · ${event.totalHours} team hours`}
                          >
                            <span>HISTORY · {event.projectName}</span>
                            <strong>{event.title}</strong>
                            <small>
                              {event.totalHours.toFixed(
                                Number.isInteger(event.totalHours) ? 0 : 1
                              )}{" "}
                              hrs · {event.participantCount} participant
                              {event.participantCount === 1 ? "" : "s"}
                            </small>
                          </button>
                        );
                      }

                      const eventClass =
                        event.status === "blocked"
                          ? styles.blockedEvent
                            : event.status === "completed"
                              ? styles.completedEvent
                              : event.priority === "critical" ||
                                  event.priority === "high"
                                ? styles.priorityEvent
                                : styles.taskEvent;

                      return (
                        <button
                          type="button"
                          className={eventClass}
                          key={event.key}
                          onClick={() => setSelectedTaskId(event.taskId)}
                          title={`${event.title} · ${statusLabel(
                            event.status
                          )}`}
                        >
                          <strong>{event.title}</strong>
                          <span>
                            {event.projectName}
                            {event.leadName
                              ? ` · ${event.leadName}`
                              : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.unscheduledSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">NEEDS A DATE</p>
            <h2>Unscheduled Operational Tasks</h2>
          </div>
          <span>{unscheduledTasks.length}</span>
        </div>

        {unscheduledTasks.length === 0 ? (
          <div className={styles.emptyUnscheduled}>
            Every open operational task has a deadline.
          </div>
        ) : (
          <div className={styles.unscheduledGrid}>
            {unscheduledTasks.map((task) => (
              <button
                type="button"
                className={styles.unscheduledTask}
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <span>{task.project_name}</span>
                <strong>{task.title}</strong>
                <small>
                  {task.lead_name
                    ? `Lead: ${task.lead_name}`
                    : "Lead: Unassigned"}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          projects={taskProjects}
          categories={categories}
          teamMembers={teamMembers}
          currentUser={currentUser}
          onClose={() => setSelectedTaskId(null)}
          onChanged={loadCalendar}
        />
      )}

      {selectedHistory && (
        <HistoricalWorkModal
          event={selectedHistory}
          onClose={() => setSelectedHistory(null)}
        />
      )}
    </>
  );
}
