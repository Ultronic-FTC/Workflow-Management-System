import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type NewTaskBody = {
  title?: string;
  description?: string;
  project_id?: string;
  category_id?: string;
  priority?: "low" | "normal" | "high" | "critical";
  difficulty?: number | null;
  people_needed?: number;
  estimated_minutes?: number | null;
  deadline?: string | null;
  lead_member_id?: string | null;
  poc_member_id?: string | null;
  assignee_ids?: string[];
  created_by_member_id?: string | null;
};

const allowedPriorities = new Set(["low", "normal", "high", "critical"]);


type ProjectRow = {
  id: string;
  name: string;
  division: "technical" | "operational" | "both";
  status: string;
};

type CategoryRow = {
  id: string;
  name: string;
  division: "technical" | "operational";
  sort_order: number;
};

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
  category_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  difficulty: number | null;
  people_needed: number;
  estimated_minutes: number | null;
  deadline: string | null;
  lead_member_id: string | null;
  poc_member_id: string | null;
  position: number;
  created_at: string;
};


export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const [
      tasksResult,
      projectsResult,
      categoriesResult,
      membersResult,
      assignmentsResult,
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, project_id, category_id, title, description, status, priority, difficulty, people_needed, estimated_minutes, deadline, lead_member_id, poc_member_id, position, created_at"
        )
        .neq("status", "archived")
        .order("position", { ascending: true })
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),

      supabase
        .from("projects")
        .select("id, name, division, status")
        .neq("status", "archived")
        .order("name", { ascending: true }),

      supabase
        .from("categories")
        .select("id, name, division, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true }),

      supabase
        .from("team_members")
        .select("id, name, role, division, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabase
        .from("task_assignments")
        .select("task_id, member_id")
        .order("assigned_at", { ascending: true }),
    ]);

    const firstError =
      tasksResult.error ||
      projectsResult.error ||
      categoriesResult.error ||
      membersResult.error ||
      assignmentsResult.error;

    if (firstError) {
      console.error("Unable to load team board:", firstError);
      return NextResponse.json(
        { error: "Unable to load team board." },
        { status: 500 }
      );
    }

    const projects = (projectsResult.data ?? []) as ProjectRow[];
    const categories = (categoriesResult.data ?? []) as CategoryRow[];
    const members = (membersResult.data ?? []) as MemberRow[];
    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const taskRows = (tasksResult.data ?? []) as TaskRow[];

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const categoryMap = new Map(
      categories.map((category) => [category.id, category])
    );
    const memberMap = new Map(members.map((member) => [member.id, member]));

    const assignmentsByTask = new Map<string, string[]>();
    for (const assignment of assignments) {
      const existing = assignmentsByTask.get(assignment.task_id) ?? [];
      existing.push(assignment.member_id);
      assignmentsByTask.set(assignment.task_id, existing);
    }

    const tasks = taskRows.map((task) => {
      const project = projectMap.get(task.project_id);
      const category = categoryMap.get(task.category_id);
      const lead = task.lead_member_id
        ? memberMap.get(task.lead_member_id)
        : null;
      const poc = task.poc_member_id ? memberMap.get(task.poc_member_id) : null;
      const assignmentIds = assignmentsByTask.get(task.id) ?? [];

      return {
        ...task,
        project_name: project?.name ?? "Unknown Project",
        project_division: project?.division ?? "both",
        category_name: category?.name ?? "Unknown Category",
        category_division: category?.division ?? "operational",
        lead_name: lead?.name ?? null,
        poc_name: poc?.name ?? null,
        assignee_ids: assignmentIds,
        assignee_names: assignmentIds
          .map((id) => memberMap.get(id)?.name)
          .filter((name): name is string => Boolean(name)),
        assigned_count: assignmentIds.length,
      };
    });

    return NextResponse.json(
      {
        tasks,
        projects,
        categories,
        members,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Team board API failed:", error);
    return NextResponse.json(
      { error: "Team board service is not configured." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as NewTaskBody;

    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() || null;
    const projectId = body.project_id ?? "";
    const categoryId = body.category_id ?? "";
    const priority = body.priority ?? "normal";
    const peopleNeeded = Math.max(1, Number(body.people_needed ?? 1));
    const difficulty =
      body.difficulty == null ? null : Number(body.difficulty);
    const estimatedMinutes =
      body.estimated_minutes == null
        ? null
        : Math.max(0, Number(body.estimated_minutes));
    const deadline = body.deadline || null;
    const leadMemberId = body.lead_member_id || null;
    const pocMemberId = body.poc_member_id || null;
    const createdByMemberId = body.created_by_member_id || null;

    const assigneeIds = Array.from(
      new Set(
        (body.assignee_ids ?? [])
          .filter((value): value is string => Boolean(value))
          .concat(leadMemberId ? [leadMemberId] : [])
      )
    );

    if (title.length < 2 || title.length > 160) {
      return NextResponse.json(
        { error: "Task name must be between 2 and 160 characters." },
        { status: 400 }
      );
    }

    if (!projectId || !categoryId) {
      return NextResponse.json(
        { error: "Project and category are required." },
        { status: 400 }
      );
    }

    if (!allowedPriorities.has(priority)) {
      return NextResponse.json(
        { error: "Invalid task priority." },
        { status: 400 }
      );
    }

    if (
      difficulty != null &&
      (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
    ) {
      return NextResponse.json(
        { error: "Difficulty must be between 1 and 5." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(peopleNeeded) || peopleNeeded < 1 || peopleNeeded > 20) {
      return NextResponse.json(
        { error: "People needed must be between 1 and 20." },
        { status: 400 }
      );
    }

    if (assigneeIds.length > peopleNeeded) {
      return NextResponse.json(
        {
          error:
            "You assigned more people than the task's People Needed value.",
        },
        { status: 400 }
      );
    }

    const status = leadMemberId ? "assigned" : "needs_assignment";
    const supabase = createAdminClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        category_id: categoryId,
        title,
        description,
        status,
        priority,
        difficulty,
        people_needed: peopleNeeded,
        estimated_minutes: estimatedMinutes,
        deadline,
        lead_member_id: leadMemberId,
        poc_member_id: pocMemberId,
        created_by_member_id: createdByMemberId,
      })
      .select(
        "id, project_id, category_id, title, description, status, priority, difficulty, people_needed, estimated_minutes, deadline, lead_member_id, poc_member_id, position, created_at"
      )
      .single();

    if (taskError || !task) {
      console.error("Unable to create task:", taskError);
      return NextResponse.json(
        { error: "Unable to create task." },
        { status: 500 }
      );
    }

    if (assigneeIds.length > 0) {
      const assignmentRows = assigneeIds.map((memberId) => ({
        task_id: task.id,
        member_id: memberId,
        assignment_source:
          memberId === createdByMemberId && memberId !== leadMemberId
            ? "self"
            : "assigned",
        assigned_by_member_id: createdByMemberId,
      }));

      const { error: assignmentError } = await supabase
        .from("task_assignments")
        .insert(assignmentRows);

      if (assignmentError) {
        console.error(
          "Task created but assignments could not be saved:",
          assignmentError
        );
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Create task failed:", error);
    return NextResponse.json(
      { error: "Unable to create task." },
      { status: 500 }
    );
  }
}
