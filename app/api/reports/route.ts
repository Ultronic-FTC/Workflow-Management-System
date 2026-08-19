import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

const PAGE_SIZE = 1000;

type MemberRow = {
  id: string;
  name: string;
  role: string;
  division: string;
  sort_order: number;
  active: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  division: "technical" | "operational";
};

type ProjectRow = {
  id: string;
  name: string;
  division: "technical" | "operational" | "both";
};

type TaskRow = {
  id: string;
  project_id: string;
  category_id: string;
  deadline: string | null;
};

type TimeEntryRow = {
  id: string;
  task_id: string;
  member_id: string;
  work_date: string;
  minutes: number;
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

type ImpactRow = {
  impact_year: number;
  project_id: string | null;
  project_name: string;
  impact_month: number | null;
  people_impacted: number;
};

type Division = "operational" | "technical";

type AggregateRow = {
  key: string;
  label: string;
  months: number[];
  total: number;
};

type Pivot = {
  rows: AggregateRow[];
  month_totals: number[];
  grand_total: number;
};

async function fetchAll(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<unknown[]> {
  const output: unknown[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(
      from,
      from + PAGE_SIZE - 1
    );

    if (error) throw error;

    const rows = data ?? [];
    output.push(...rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return output;
}

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

  // Historical spreadsheet data was originally an outreach/operations log.
  return "operational";
}

function addMinutes(
  map: Map<string, number[]>,
  key: string,
  monthIndex: number,
  minutes: number
) {
  const months = map.get(key) ?? Array(12).fill(0);
  months[monthIndex] += Number(minutes || 0);
  map.set(key, months);
}

function pivotFromMap(
  map: Map<string, number[]>,
  labels: Map<string, string>,
  includeKeys: Set<string> | null,
  orderByKey: Map<string, number> | null
): Pivot {
  const keys = new Set(map.keys());

  if (includeKeys) {
    for (const key of includeKeys) keys.add(key);
  }

  const rows = [...keys].map((key) => {
    const months = map.get(key) ?? Array(12).fill(0);
    const total = months.reduce((sum, value) => sum + value, 0);

    return {
      key,
      label: labels.get(key) ?? key,
      months,
      total,
    };
  });

  rows.sort((a, b) => {
    // Put the highest total hours at the top of every pivot table.
    if (a.total !== b.total) return b.total - a.total;

    // Use roster order only as a tie-breaker for equal totals.
    if (orderByKey) {
      const aOrder = orderByKey.get(a.key) ?? 999999;
      const bOrder = orderByKey.get(b.key) ?? 999999;

      if (aOrder !== bOrder) return aOrder - bOrder;
    }

    return a.label.localeCompare(b.label);
  });

  const monthTotals = Array(12).fill(0);

  for (const row of rows) {
    row.months.forEach((value, index) => {
      monthTotals[index] += value;
    });
  }

  return {
    rows,
    month_totals: monthTotals,
    grand_total: monthTotals.reduce((sum, value) => sum + value, 0),
  };
}

export async function GET(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const requestedYear = Number(url.searchParams.get("year"));
    const currentYear = new Date().getFullYear();
    const supabase = createAdminClient();

    const [
      memberRows,
      categoryRows,
      projectRows,
      taskRows,
      timeEntryRows,
      historicalRows,
      impactRows,
    ] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("team_members")
          .select("id, name, role, division, sort_order, active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("categories")
          .select("id, name, division")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("projects")
          .select("id, name, division")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("tasks")
          .select("id, project_id, category_id, deadline")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("time_entries")
          .select("id, task_id, member_id, work_date, minutes")
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
      fetchAll((from, to) =>
        supabase
          .from("project_impact")
          .select(
            "impact_year, project_id, project_name, impact_month, people_impacted"
          )
          .order("project_name", { ascending: true })
          .order("impact_month", { ascending: true, nullsFirst: false })
          .range(from, to)
      ),
    ]);

    const members = memberRows as MemberRow[];
    const categories = categoryRows as CategoryRow[];
    const projects = projectRows as ProjectRow[];
    const tasks = taskRows as TaskRow[];
    const timeEntries = timeEntryRows as TimeEntryRow[];
    const history = historicalRows as HistoricalRow[];
    const impact = impactRows as ImpactRow[];

    const years = new Set<number>();

    for (const entry of timeEntries) {
      const parts = dateParts(entry.work_date);
      if (parts) years.add(parts.year);
    }

    for (const entry of history) {
      const parts = dateParts(entry.work_date);
      if (parts) years.add(parts.year);
    }

    for (const entry of impact) {
      if (Number.isInteger(entry.impact_year)) {
        years.add(entry.impact_year);
      }
    }

    if (years.size === 0) years.add(currentYear);

    const availableYears = [...years].sort((a, b) => b - a);
    const year =
      Number.isInteger(requestedYear) && years.has(requestedYear)
        ? requestedYear
        : availableYears[0] ?? currentYear;

    const memberById = new Map(members.map((member) => [member.id, member]));
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

    const personLabels = new Map<string, string>(
      members.map((member) => [member.id, member.name])
    );
    const personOrder = new Map<string, number>(
      members.map((member) => [member.id, member.sort_order])
    );

    const activeMemberIds = new Set(
      members.filter((member) => member.active).map((member) => member.id)
    );

    const operationsPeople = new Map<string, number[]>();
    const technicalPeople = new Map<string, number[]>();
    const operationsProjects = new Map<string, number[]>();
    const technicalProjects = new Map<string, number[]>();
    const projectLabels = new Map<string, string>();

    // Tracks whether an actual task/activity exists for a project in each
    // month. Reports uses this to highlight likely impact-entry months.
    const taskMonthsByProject = new Map<string, boolean[]>();

    function markTaskMonth(projectId: string, monthIndex: number) {
      if (monthIndex < 0 || monthIndex > 11) return;

      const months =
        taskMonthsByProject.get(projectId) ?? Array(12).fill(false);

      months[monthIndex] = true;
      taskMonthsByProject.set(projectId, months);
    }

    const operationsActivities = Array.from(
      { length: 12 },
      () => new Set<string>()
    );

    // Historical imported spreadsheet rows.
    for (const entry of history) {
      const parts = dateParts(entry.work_date);
      if (!parts || parts.year !== year) continue;

      const division = fallbackDivision(
        entry.category_name,
        entry.project_name,
        categoryByName,
        projectByName
      );

      const personKey = entry.member_id;
      const canonicalProject = projectByName.get(
        normalize(entry.project_name)
      );

      if (!personLabels.has(personKey)) {
        personLabels.set(
          personKey,
          memberById.get(personKey)?.name ?? "Unknown Member"
        );
      }

      if (canonicalProject) {
        projectLabels.set(canonicalProject.id, canonicalProject.name);
        markTaskMonth(canonicalProject.id, parts.monthIndex);
      }

      if (division === "technical") {
        addMinutes(
          technicalPeople,
          personKey,
          parts.monthIndex,
          entry.minutes
        );

        if (canonicalProject) {
          addMinutes(
            technicalProjects,
            canonicalProject.id,
            parts.monthIndex,
            entry.minutes
          );
        }
      } else {
        addMinutes(
          operationsPeople,
          personKey,
          parts.monthIndex,
          entry.minutes
        );

        if (canonicalProject) {
          addMinutes(
            operationsProjects,
            canonicalProject.id,
            parts.monthIndex,
            entry.minutes
          );
        }

        const activityKey = [
          "historical",
          parts.dateKey,
          normalize(entry.category_name),
          normalize(entry.project_name),
          normalize(entry.task_name),
          normalize(entry.work_type),
          normalize(entry.description),
        ].join("|");

        operationsActivities[parts.monthIndex].add(activityKey);
      }
    }

    // Current/live time entries.
    for (const entry of timeEntries) {
      const parts = dateParts(entry.work_date);
      if (!parts || parts.year !== year) continue;

      const task = taskById.get(entry.task_id);
      if (!task) continue;

      const category = categoryById.get(task.category_id);
      const project = projectById.get(task.project_id);

      const division: Division =
        category?.division === "technical" ? "technical" : "operational";

      const personKey = entry.member_id;

      if (!personLabels.has(personKey)) {
        personLabels.set(
          personKey,
          memberById.get(personKey)?.name ?? "Unknown Member"
        );
      }

      if (project) {
        projectLabels.set(project.id, project.name);
        markTaskMonth(project.id, parts.monthIndex);
      }

      if (division === "technical") {
        addMinutes(
          technicalPeople,
          personKey,
          parts.monthIndex,
          entry.minutes
        );

        if (project) {
          addMinutes(
            technicalProjects,
            project.id,
            parts.monthIndex,
            entry.minutes
          );
        }
      } else {
        addMinutes(
          operationsPeople,
          personKey,
          parts.monthIndex,
          entry.minutes
        );

        if (project) {
          addMinutes(
            operationsProjects,
            project.id,
            parts.monthIndex,
            entry.minutes
          );
        }

        // One task worked on one date counts as one activity,
        // regardless of how many students logged hours that day.
        operationsActivities[parts.monthIndex].add(
          `live|${parts.dateKey}|${entry.task_id}`
        );
      }
    }

    for (const task of tasks) {
      const project = projectById.get(task.project_id);
      if (!project) continue;

      const parts = dateParts(task.deadline);

      if (parts && parts.year === year) {
        projectLabels.set(project.id, project.name);
        markTaskMonth(project.id, parts.monthIndex);
      }
    }

    const operationsProjectImpact = new Map<string, number>();
    const impactMonthsByProject = new Map<string, number[]>();
    const impactOneTimeByProject = new Map<string, number>();

    for (const entry of impact) {
      if (entry.impact_year !== year || !entry.project_id) continue;

      const project = projectById.get(entry.project_id);

      // Never surface a legacy/free-text impact label as a project.
      // Impact only counts when it maps to an actual project record.
      if (!project) continue;

      const projectKey = project.id;
      const people = Number(entry.people_impacted || 0);

      projectLabels.set(projectKey, project.name);

      operationsProjectImpact.set(
        projectKey,
        (operationsProjectImpact.get(projectKey) ?? 0) + people
      );

      if (
        entry.impact_month != null &&
        entry.impact_month >= 1 &&
        entry.impact_month <= 12
      ) {
        const months =
          impactMonthsByProject.get(projectKey) ?? Array(12).fill(0);

        months[entry.impact_month - 1] += people;
        impactMonthsByProject.set(projectKey, months);
      } else {
        impactOneTimeByProject.set(
          projectKey,
          (impactOneTimeByProject.get(projectKey) ?? 0) + people
        );
      }

      // A real project with impact should appear even if it has no hours yet.
      if (!operationsProjects.has(projectKey)) {
        operationsProjects.set(projectKey, Array(12).fill(0));
      }
    }

    const operationsPeoplePivot = pivotFromMap(
      operationsPeople,
      personLabels,
      activeMemberIds,
      personOrder
    );

    const technicalPeoplePivot = pivotFromMap(
      technicalPeople,
      personLabels,
      activeMemberIds,
      personOrder
    );

    const operationsProjectsPivot = pivotFromMap(
      operationsProjects,
      projectLabels,
      null,
      null
    );

    const technicalProjectsPivot = pivotFromMap(
      technicalProjects,
      projectLabels,
      null,
      null
    );

    const activityCounts = operationsActivities.map((set) => set.size);

    const impactMatrixKeys = new Set<string>([
      ...operationsProjects.keys(),
      ...impactMonthsByProject.keys(),
      ...impactOneTimeByProject.keys(),
    ]);

    const impactMatrix = [...impactMatrixKeys]
      .map((key) => {
        const months =
          impactMonthsByProject.get(key) ?? Array(12).fill(0);
        const oneTime = impactOneTimeByProject.get(key) ?? 0;
        const total =
          months.reduce((sum, value) => sum + value, 0) + oneTime;

        return {
          key,
          project_name: projectLabels.get(key) ?? key,
          months,
          task_months:
            taskMonthsByProject.get(key) ?? Array(12).fill(false),
          one_time: oneTime,
          total,
        };
      })
      .sort(
        (a, b) =>
          b.total - a.total ||
          a.project_name.localeCompare(b.project_name)
      );

    return NextResponse.json(
      {
        year,
        years: availableYears,
        months: MONTHS,
        operations: {
          people: operationsPeoplePivot,
          projects: operationsProjectsPivot,
          project_impact: Object.fromEntries(operationsProjectImpact),
          impact_matrix: impactMatrix,
          impact_total: [...operationsProjectImpact.values()].reduce(
            (sum, value) => sum + value,
            0
          ),
          activity_counts: activityCounts,
          activity_total: activityCounts.reduce(
            (sum, value) => sum + value,
            0
          ),
        },
        technical: {
          people: technicalPeoplePivot,
          projects: technicalProjectsPivot,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Reports API failed:", error);

    return NextResponse.json(
      { error: "Unable to load reports." },
      { status: 500 }
    );
  }
}
