import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Division = "operational" | "technical";

type MemberRow = {
  id: string;
  name: string;
};

type CategoryRow = {
  id: string;
  name: string;
  division: Division;
};

type ProjectRow = {
  id: string;
  name: string;
  division: "technical" | "operational" | "both";
};

type TaskRow = {
  id: string;
  title: string;
  project_id: string;
  category_id: string;
};

type TimeEntryRow = {
  id: string;
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function dateParts(value: string | null | undefined) {
  const match = (value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    dateKey: `${match[1]}-${match[2]}-${match[3]}`,
  };
}

function fallbackDivision(
  categoryName: string,
  projectName: string,
  categoryByName: Map<string, CategoryRow>,
  projectByName: Map<string, ProjectRow>
): Division {
  const category = categoryByName.get(normalize(categoryName));

  if (category?.division === "technical") return "technical";
  if (category?.division === "operational") return "operational";

  const text = `${categoryName} ${projectName}`.toLowerCase();

  const technicalWords = [
    "technical",
    "mechanical",
    "design",
    "build",
    "program",
    "coding",
    "software",
    "test",
    "drive team",
    "strategy",
    "cad",
    "fabricat",
    "robot",
    "electrical",
    "electronics",
  ];

  if (technicalWords.some((word) => text.includes(word))) {
    return "technical";
  }

  const operationalWords = [
    "outreach",
    "branding",
    "professional",
    "business",
    "fundrais",
    "sponsor",
    "community",
    "coach",
    "operations",
    "marketing",
    "social media",
    "advocacy",
  ];

  if (operationalWords.some((word) => text.includes(word))) {
    return "operational";
  }

  const project = projectByName.get(normalize(projectName));

  if (project?.division === "technical") return "technical";
  if (project?.division === "operational") return "operational";

  return "operational";
}

export async function GET(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get("member_id")?.trim() ?? "";
    const year = Number(url.searchParams.get("year"));
    const divisionParam = url.searchParams.get("division");
    const division: Division =
      divisionParam === "technical" ? "technical" : "operational";

    if (!memberId || !Number.isInteger(year)) {
      return NextResponse.json(
        { error: "Member and year are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const [
      memberResult,
      categoriesResult,
      projectsResult,
      tasksResult,
      timeEntriesResult,
      historyResult,
    ] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, name")
        .eq("id", memberId)
        .maybeSingle(),

      supabase
        .from("categories")
        .select("id, name, division"),

      supabase
        .from("projects")
        .select("id, name, division"),

      supabase
        .from("tasks")
        .select("id, title, project_id, category_id"),

      supabase
        .from("time_entries")
        .select("id, task_id, member_id, work_date, minutes, note")
        .eq("member_id", memberId),

      supabase
        .from("historical_work_log")
        .select(
          "member_id, work_date, category_name, project_name, task_name, minutes, work_type, description"
        )
        .eq("member_id", memberId),
    ]);

    const firstError =
      memberResult.error ||
      categoriesResult.error ||
      projectsResult.error ||
      tasksResult.error ||
      timeEntriesResult.error ||
      historyResult.error;

    if (firstError) throw firstError;

    const member = memberResult.data as MemberRow | null;

    if (!member) {
      return NextResponse.json(
        { error: "Team member not found." },
        { status: 404 }
      );
    }

    const categories = (categoriesResult.data ?? []) as CategoryRow[];
    const projects = (projectsResult.data ?? []) as ProjectRow[];
    const tasks = (tasksResult.data ?? []) as TaskRow[];
    const timeEntries = (timeEntriesResult.data ?? []) as TimeEntryRow[];
    const history = (historyResult.data ?? []) as HistoricalRow[];

    const categoryById = new Map(
      categories.map((category) => [category.id, category])
    );
    const categoryByName = new Map(
      categories.map((category) => [normalize(category.name), category])
    );
    const projectById = new Map(
      projects.map((project) => [project.id, project])
    );
    const projectByName = new Map(
      projects.map((project) => [normalize(project.name), project])
    );
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    const entries: Array<{
      id: string;
      date: string;
      project: string;
      task: string;
      category: string;
      hours_minutes: number;
      note: string | null;
      source: "Current Task" | "Historical";
    }> = [];

    for (const entry of history) {
      const parts = dateParts(entry.work_date);

      if (!parts || parts.year !== year) continue;

      const entryDivision = fallbackDivision(
        entry.category_name,
        entry.project_name,
        categoryByName,
        projectByName
      );

      if (entryDivision !== division) continue;

      entries.push({
        id: [
          "historical",
          entry.work_date,
          entry.project_name,
          entry.task_name,
          entry.minutes,
          entries.length,
        ].join("|"),
        date: parts.dateKey,
        project: entry.project_name || "Unassigned Project",
        task: entry.task_name || entry.work_type || "Historical Activity",
        category: entry.category_name || "Historical",
        hours_minutes: Number(entry.minutes || 0),
        note: entry.description || entry.work_type || null,
        source: "Historical",
      });
    }

    for (const entry of timeEntries) {
      const parts = dateParts(entry.work_date);

      if (!parts || parts.year !== year) continue;

      const task = taskById.get(entry.task_id);
      if (!task) continue;

      const category = categoryById.get(task.category_id);
      const project = projectById.get(task.project_id);

      const entryDivision: Division =
        category?.division === "technical"
          ? "technical"
          : "operational";

      if (entryDivision !== division) continue;

      entries.push({
        id: entry.id,
        date: parts.dateKey,
        project: project?.name ?? "Unassigned Project",
        task: task.title,
        category: category?.name ?? "Uncategorized",
        hours_minutes: Number(entry.minutes || 0),
        note: entry.note,
        source: "Current Task",
      });
    }

    entries.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.project !== b.project) return a.project.localeCompare(b.project);
      return a.task.localeCompare(b.task);
    });

    const monthMinutes = Array(12).fill(0);

    for (const entry of entries) {
      const parts = dateParts(entry.date);

      if (parts) {
        monthMinutes[parts.monthIndex] += entry.hours_minutes;
      }
    }

    const totalMinutes = entries.reduce(
      (sum, entry) => sum + entry.hours_minutes,
      0
    );

    return NextResponse.json(
      {
        member: {
          id: member.id,
          name: member.name,
        },
        year,
        division,
        months: MONTHS,
        month_minutes: monthMinutes,
        total_minutes: totalMinutes,
        entry_count: entries.length,
        entries,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Person hours detail failed:", error);

    return NextResponse.json(
      { error: "Unable to load detailed hours." },
      { status: 500 }
    );
  }
}
