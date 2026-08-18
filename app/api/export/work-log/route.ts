import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  division: string;
  active: boolean;
};

type Project = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  project_id: string;
  category_id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  lead_member_id: string | null;
};

type Assignment = {
  task_id: string;
  member_id: string;
};

type TimeEntry = {
  task_id: string;
  member_id: string;
  work_date: string;
  minutes: number;
  note: string | null;
};

type HistoricalRow = {
  member_id: string;
  work_date: string;
  category_name: string;
  project_name: string;
  task_name: string;
  minutes: number;
  work_type: string | null;
  description: string | null;
};

type ExportRow = {
  name: string;
  year: string;
  month: string;
  date: string;
  category: string;
  project: string;
  task: string;
  hours: string;
  type: string;
  description: string;
  status: string;
  dueDate: string;
  source: string;
};

const PAGE_SIZE = 1000;

async function fetchAll(
  buildQuery: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: unknown;
  }>
) {
  const result: unknown[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(
      from,
      from + PAGE_SIZE - 1
    );

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    result.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  return result;
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function displayStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateParts(value: string | null | undefined) {
  if (!value) {
    return { year: "", month: "", date: "" };
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return { year: "", month: "", date: value };
  }

  return {
    year: match[1],
    month: String(Number(match[2])),
    date: `${Number(match[2])}/${Number(match[3])}/${match[1]}`,
  };
}

function hoursFromMinutes(minutes: number) {
  const hours = Number(minutes || 0) / 60;
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

function filenameDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const [
      memberRows,
      projectRows,
      categoryRows,
      taskRows,
      assignmentRows,
      timeRows,
      historicalRows,
    ] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("team_members")
          .select("id, name, role, division, active")
          .order("name", { ascending: true })
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("projects")
          .select("id, name")
          .order("name", { ascending: true })
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true })
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("tasks")
          .select(
            "id, project_id, category_id, title, description, status, deadline, lead_member_id"
          )
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("task_assignments")
          .select("task_id, member_id")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("time_entries")
          .select("task_id, member_id, work_date, minutes, note")
          .order("work_date", { ascending: true })
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("historical_work_log")
          .select(
            "member_id, work_date, category_name, project_name, task_name, minutes, work_type, description"
          )
          .order("work_date", { ascending: true })
          .range(from, to)
      ),
    ]);

    const members = memberRows as TeamMember[];
    const projects = projectRows as Project[];
    const categories = categoryRows as Category[];
    const tasks = taskRows as Task[];
    const assignments = assignmentRows as Assignment[];
    const timeEntries = timeRows as TimeEntry[];
    const history = historicalRows as HistoricalRow[];

    const memberMap = new Map(
      members.map((member) => [member.id, member])
    );
    const projectMap = new Map(
      projects.map((project) => [project.id, project.name])
    );
    const categoryMap = new Map(
      categories.map((category) => [category.id, category.name])
    );
    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    const rows: ExportRow[] = [];

    // 1. Preserve every historical individual-hours record.
    for (const row of history) {
      const parts = dateParts(row.work_date);

      rows.push({
        name: memberMap.get(row.member_id)?.name ?? "Unknown",
        year: parts.year,
        month: parts.month,
        date: parts.date,
        category: row.category_name,
        project: row.project_name,
        task: row.task_name,
        hours: hoursFromMinutes(row.minutes),
        type: row.work_type ?? "",
        description: row.description ?? "",
        status: "Completed",
        dueDate: "",
        source: "Historical",
      });
    }

    // 2. Export every live actual-time entry.
    const taskMembersWithTime = new Map<string, Set<string>>();

    for (const entry of timeEntries) {
      const task = taskMap.get(entry.task_id);
      if (!task) continue;

      const parts = dateParts(entry.work_date);
      const key = entry.task_id;

      if (!taskMembersWithTime.has(key)) {
        taskMembersWithTime.set(key, new Set());
      }
      taskMembersWithTime.get(key)?.add(entry.member_id);

      rows.push({
        name: memberMap.get(entry.member_id)?.name ?? "Unknown",
        year: parts.year,
        month: parts.month,
        date: parts.date,
        category:
          categoryMap.get(task.category_id) ?? "Unknown Category",
        project:
          projectMap.get(task.project_id) ?? "Unknown Project",
        task: task.title,
        hours: hoursFromMinutes(entry.minutes),
        type: "Logged Time",
        description: entry.note || task.description || "",
        status: displayStatus(task.status),
        dueDate: task.deadline ?? "",
        source: "Live Task",
      });
    }

    // 3. Make sure every current task + assigned person is represented,
    // even when that person has not logged time yet.
    const assignmentsByTask = new Map<string, Set<string>>();

    for (const assignment of assignments) {
      if (!assignmentsByTask.has(assignment.task_id)) {
        assignmentsByTask.set(assignment.task_id, new Set());
      }

      assignmentsByTask
        .get(assignment.task_id)
        ?.add(assignment.member_id);
    }

    for (const task of tasks) {
      const representedByTime =
        taskMembersWithTime.get(task.id) ?? new Set<string>();
      const assigned =
        assignmentsByTask.get(task.id) ?? new Set<string>();

      if (task.lead_member_id) {
        assigned.add(task.lead_member_id);
      }

      const people =
        assigned.size > 0 ? [...assigned] : [null];

      for (const memberId of people) {
        if (memberId && representedByTime.has(memberId)) {
          continue;
        }

        rows.push({
          name: memberId
            ? memberMap.get(memberId)?.name ?? "Unknown"
            : "Unassigned",
          year: "",
          month: "",
          date: "",
          category:
            categoryMap.get(task.category_id) ?? "Unknown Category",
          project:
            projectMap.get(task.project_id) ?? "Unknown Project",
          task: task.title,
          hours: "0",
          type: "Task Assignment",
          description: task.description ?? "",
          status: displayStatus(task.status),
          dueDate: task.deadline ?? "",
          source: "Live Task",
        });
      }
    }

    rows.sort((a, b) => {
      const aDate = a.date ? `${a.year}-${a.month.padStart(2, "0")}-${a.date}` : "9999";
      const bDate = b.date ? `${b.year}-${b.month.padStart(2, "0")}-${b.date}` : "9999";

      return (
        aDate.localeCompare(bDate) ||
        a.project.localeCompare(b.project) ||
        a.task.localeCompare(b.task) ||
        a.name.localeCompare(b.name)
      );
    });

    const headers = [
      "Name",
      "Year",
      "Month",
      "Date",
      "Category",
      "Project",
      "Task",
      "Hours",
      "Type",
      "Description",
      "Status",
      "Due Date",
      "Source",
    ];

    const csvRows = [
      headers.map(csvCell).join(","),
      ...rows.map((row) =>
        [
          row.name,
          row.year,
          row.month,
          row.date,
          row.category,
          row.project,
          row.task,
          row.hours,
          row.type,
          row.description,
          row.status,
          row.dueDate,
          row.source,
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    const csv = "\uFEFF" + csvRows.join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Ultronic-Work-Log-${filenameDate()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Work-log export failed:", error);

    return NextResponse.json(
      { error: "Unable to export work log." },
      { status: 500 }
    );
  }
}
