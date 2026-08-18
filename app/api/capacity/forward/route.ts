import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MemberRow = {
  id: string;
  name: string;
  role: string;
  division: string;
  sort_order: number;
};

type AssignmentRow = {
  task_id: string;
  member_id: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  priority: string;
  estimated_minutes: number | null;
  deadline: string | null;
  lead_member_id: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
};

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateFromYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function ymd(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value: string, days: number) {
  const date = dateFromYmd(value);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function normalizeDate(value: string | null) {
  if (!value) return null;

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function taskWeekIndex(
  deadline: string | null,
  weekStarts: string[],
  weekEnds: string[]
) {
  if (!deadline) return null;

  // Overdue tasks stay visible in the current week.
  if (deadline < weekStarts[0]) return 0;

  for (let index = 0; index < weekStarts.length; index += 1) {
    if (deadline >= weekStarts[index] && deadline <= weekEnds[index]) {
      return index;
    }
  }

  return null;
}

export async function GET(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get("start_date") ?? "";

  if (!isDate(startDate)) {
    return NextResponse.json(
      { error: "A valid start_date is required." },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    const [membersResult, assignmentsResult, tasksResult, projectsResult] =
      await Promise.all([
        supabase
          .from("team_members")
          .select("id, name, role, division, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),

        supabase
          .from("task_assignments")
          .select("task_id, member_id"),

        supabase
          .from("tasks")
          .select(
            "id, project_id, title, status, priority, estimated_minutes, deadline, lead_member_id"
          )
          .neq("status", "completed")
          .neq("status", "archived")
          .order("deadline", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true }),

        supabase
          .from("projects")
          .select("id, name")
          .neq("status", "archived"),
      ]);

    const firstError =
      membersResult.error ||
      assignmentsResult.error ||
      tasksResult.error ||
      projectsResult.error;

    if (firstError) {
      console.error("Unable to load forward capacity:", firstError);

      return NextResponse.json(
        { error: "Unable to load 3-week capacity." },
        { status: 500 }
      );
    }

    const members = (membersResult.data ?? []) as MemberRow[];
    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const tasks = (tasksResult.data ?? []) as TaskRow[];
    const projects = (projectsResult.data ?? []) as ProjectRow[];

    const weekStarts = [startDate, addDays(startDate, 7), addDays(startDate, 14)];
    const weekEnds = weekStarts.map((start) => addDays(start, 6));
    const endDate = weekEnds[2];

    const memberMap = new Map(members.map((member) => [member.id, member]));
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const projectMap = new Map(
      projects.map((project) => [project.id, project.name])
    );

    // Include explicit assignments plus the lead as an assigned person.
    const memberIdsByTask = new Map<string, Set<string>>();

    for (const assignment of assignments) {
      if (!taskMap.has(assignment.task_id)) continue;
      if (!memberMap.has(assignment.member_id)) continue;

      const set = memberIdsByTask.get(assignment.task_id) ?? new Set<string>();
      set.add(assignment.member_id);
      memberIdsByTask.set(assignment.task_id, set);
    }

    for (const task of tasks) {
      if (!task.lead_member_id || !memberMap.has(task.lead_member_id)) {
        continue;
      }

      const set = memberIdsByTask.get(task.id) ?? new Set<string>();
      set.add(task.lead_member_id);
      memberIdsByTask.set(task.id, set);
    }

    const uniqueTasksInWindow = new Map<string, TaskRow>();
    const rows = members.map((member) => {
      const weeks = [[], [], []] as Array<
        Array<{
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
        }>
      >;

      const unscheduled: typeof weeks[number] = [];

      for (const task of tasks) {
        const assignedMemberIds = memberIdsByTask.get(task.id);
        if (!assignedMemberIds?.has(member.id)) continue;

        const deadline = normalizeDate(task.deadline);
        const assignedCount = assignedMemberIds.size;

        const forecastTask = {
          id: task.id,
          title: task.title,
          project_name: projectMap.get(task.project_id) ?? "Unknown Project",
          deadline,
          status: task.status,
          priority: task.priority,
          estimated_minutes: task.estimated_minutes,
          assigned_count: assignedCount,
          is_lead: task.lead_member_id === member.id,
          overdue: Boolean(deadline && deadline < startDate),
        };

        if (!deadline) {
          unscheduled.push(forecastTask);
          continue;
        }

        const weekIndex = taskWeekIndex(deadline, weekStarts, weekEnds);

        if (weekIndex == null) {
          // A dated task beyond the three-week window is intentionally omitted.
          continue;
        }

        weeks[weekIndex].push(forecastTask);
        uniqueTasksInWindow.set(task.id, task);
      }

      for (const task of unscheduled) {
        uniqueTasksInWindow.set(task.id, taskMap.get(task.id)!);
      }

      for (const week of weeks) {
        week.sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;

          const aDate = a.deadline ?? "9999-12-31";
          const bDate = b.deadline ?? "9999-12-31";

          return (
            aDate.localeCompare(bDate) ||
            a.project_name.localeCompare(b.project_name) ||
            a.title.localeCompare(b.title)
          );
        });
      }

      unscheduled.sort(
        (a, b) =>
          a.project_name.localeCompare(b.project_name) ||
          a.title.localeCompare(b.title)
      );

      const visibleTasks = [...weeks.flat(), ...unscheduled];

      return {
        ...member,
        assignment_count: visibleTasks.length,
        estimated_minutes: visibleTasks.reduce(
          (sum, task) => sum + Number(task.estimated_minutes ?? 0),
          0
        ),
        unestimated_count: visibleTasks.filter(
          (task) => task.estimated_minutes == null
        ).length,
        weeks,
        unscheduled,
      };
    });

    const visibleRows = rows.filter(
      (member) => member.assignment_count > 0
    );

    const uniqueTasks = [...uniqueTasksInWindow.values()];

    const assignmentCount = visibleRows.reduce(
      (sum, member) => sum + member.assignment_count,
      0
    );

    const summary = {
      unique_task_count: uniqueTasks.length,
      assignment_count: assignmentCount,
      estimated_minutes: uniqueTasks.reduce(
        (sum, task) => sum + Number(task.estimated_minutes ?? 0),
        0
      ),
      unestimated_task_count: uniqueTasks.filter(
        (task) => task.estimated_minutes == null
      ).length,
      overdue_task_count: uniqueTasks.filter((task) => {
        const deadline = normalizeDate(task.deadline);
        return Boolean(deadline && deadline < startDate);
      }).length,
    };

    return NextResponse.json(
      {
        start_date: startDate,
        end_date: endDate,
        weeks: weekStarts.map((start, index) => ({
          start,
          end: weekEnds[index],
        })),
        summary,
        members: visibleRows,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Forward capacity API failed:", error);

    return NextResponse.json(
      { error: "Unable to load 3-week capacity." },
      { status: 500 }
    );
  }
}
