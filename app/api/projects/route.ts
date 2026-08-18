import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type NewProjectBody = {
  name?: string;
  description?: string;
  division?: "technical" | "operational" | "both";
  status?: "planning" | "active" | "paused" | "completed";
  lead_member_id?: string | null;
  target_date?: string | null;
  created_by_member_id?: string | null;
};

type UpdateProjectBody = {
  id?: string;
  name?: string;
  description?: string | null;
  division?: "technical" | "operational" | "both";
  status?: "planning" | "active" | "paused" | "completed";
  lead_member_id?: string | null;
  target_date?: string | null;
  actor_member_id?: string | null;
};

type HistoricalProjectRow = {
  work_date: string;
  project_name: string;
  category_name: string;
  task_name: string;
  work_type: string | null;
  description: string | null;
  minutes: number;
};

function historicalActivityKey(row: HistoricalProjectRow) {
  return [
    row.work_date,
    row.category_name,
    row.task_name,
    row.work_type ?? "",
    row.description ?? "",
  ].join("||");
}

const allowedDivisions = new Set(["technical", "operational", "both"]);
const allowedStatuses = new Set(["planning", "active", "paused", "completed"]);

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select(
        "id, name, description, division, status, lead_member_id, target_date, created_at"
      )
      .neq("status", "archived")
      .order("target_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (projectError) {
      console.error("Unable to load projects:", projectError);
      return NextResponse.json(
        { error: "Unable to load projects." },
        { status: 500 }
      );
    }

    const projectRows = projects ?? [];
    const projectIds = projectRows.map((project) => project.id);
    const leadIds = Array.from(
      new Set(
        projectRows
          .map((project) => project.lead_member_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const taskRows =
      projectIds.length === 0
        ? []
        : (
            await supabase
              .from("tasks")
              .select("project_id, status")
              .in("project_id", projectIds)
              .neq("status", "archived")
          ).data ?? [];

    const { data: historicalRows, error: historyError } = await supabase
      .from("historical_work_log")
      .select(
        "work_date, project_name, category_name, task_name, work_type, description, minutes"
      );

    if (historyError) {
      console.error("Unable to load historical project work:", historyError);
      return NextResponse.json(
        { error: "Unable to load historical project work." },
        { status: 500 }
      );
    }

    const leadRows =
      leadIds.length === 0
        ? []
        : (
            await supabase
              .from("team_members")
              .select("id, name")
              .in("id", leadIds)
          ).data ?? [];

    const leadNames = new Map(
      leadRows.map((member) => [member.id, member.name])
    );

    const historicalByProject = new Map<
      string,
      { minutes: number; activities: Set<string> }
    >();

    for (const row of (historicalRows ?? []) as HistoricalProjectRow[]) {
      const key = row.project_name.trim().toLowerCase();
      const current = historicalByProject.get(key) ?? {
        minutes: 0,
        activities: new Set<string>(),
      };

      current.minutes += Number(row.minutes || 0);
      current.activities.add(historicalActivityKey(row));
      historicalByProject.set(key, current);
    }

    const projectsWithStats = projectRows.map((project) => {
      const projectTasks = taskRows.filter(
        (task) => task.project_id === project.id
      );
      const completedCount = projectTasks.filter(
        (task) => task.status === "completed"
      ).length;
      const blockedCount = projectTasks.filter(
        (task) => task.status === "blocked"
      ).length;
      const reviewCount = projectTasks.filter(
        (task) => task.status === "ready_for_review"
      ).length;
      const liveTaskCount = projectTasks.length;

      const historicalStats = historicalByProject.get(
        project.name.trim().toLowerCase()
      );
      const historicalActivityCount =
        historicalStats?.activities.size ?? 0;
      const historicalHours = (historicalStats?.minutes ?? 0) / 60;

      const historicalOnly =
        project.status === "completed" &&
        liveTaskCount === 0 &&
        historicalActivityCount > 0;

      const taskCount = historicalOnly
        ? historicalActivityCount
        : liveTaskCount;

      const displayedCompletedCount = historicalOnly
        ? historicalActivityCount
        : completedCount;

      const progress = historicalOnly
        ? 100
        : liveTaskCount === 0
          ? 0
          : Math.round((completedCount / liveTaskCount) * 100);

      return {
        ...project,
        lead_name: project.lead_member_id
          ? leadNames.get(project.lead_member_id) ?? "Unknown"
          : null,
        task_count: taskCount,
        live_task_count: liveTaskCount,
        completed_count: displayedCompletedCount,
        blocked_count: blockedCount,
        review_count: reviewCount,
        progress,
        historical_activity_count: historicalActivityCount,
        historical_hours: historicalHours,
        historical_only: historicalOnly,
      };
    });

    return NextResponse.json(
      { projects: projectsWithStats },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Projects API failed:", error);
    return NextResponse.json(
      { error: "Project service is not configured." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as NewProjectBody;

    const name = body.name?.trim() ?? "";
    const description = body.description?.trim() || null;
    const division = body.division ?? "operational";
    const status = body.status ?? "active";
    const leadMemberId = body.lead_member_id || null;
    const targetDate = body.target_date || null;
    const createdByMemberId = body.created_by_member_id || null;

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json(
        { error: "Project name must be between 2 and 120 characters." },
        { status: 400 }
      );
    }

    if (!allowedDivisions.has(division)) {
      return NextResponse.json(
        { error: "Invalid project division." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "Invalid project status." },
        { status: 400 }
      );
    }

    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json(
        { error: "Target date must use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        description,
        division,
        status,
        lead_member_id: leadMemberId,
        target_date: targetDate,
        created_by_member_id: createdByMemberId,
      })
      .select(
        "id, name, description, division, status, lead_member_id, target_date, created_at"
      )
      .single();

    if (error) {
      console.error("Unable to create project:", error);
      return NextResponse.json(
        { error: "Unable to create project." },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    console.error("Create project failed:", error);
    return NextResponse.json(
      { error: "Unable to create project." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as UpdateProjectBody;

    const id = body.id?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const description = body.description?.trim() || null;
    const division = body.division ?? "operational";
    const status = body.status ?? "active";
    const leadMemberId = body.lead_member_id || null;
    const targetDate = body.target_date || null;
    const actorMemberId = body.actor_member_id || null;

    if (!id) {
      return NextResponse.json(
        { error: "Project id is required." },
        { status: 400 }
      );
    }

    if (!actorMemberId) {
      return NextResponse.json(
        { error: "Select yourself under Working As before editing a project." },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json(
        { error: "Project name must be between 2 and 120 characters." },
        { status: 400 }
      );
    }

    if (!allowedDivisions.has(division)) {
      return NextResponse.json(
        { error: "Invalid project division." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "Invalid project status." },
        { status: 400 }
      );
    }

    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json(
        { error: "Target date must use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: actor, error: actorError } = await supabase
      .from("team_members")
      .select("id, active")
      .eq("id", actorMemberId)
      .maybeSingle();

    if (actorError) {
      throw actorError;
    }

    if (!actor || actor.active === false) {
      return NextResponse.json(
        { error: "Only an active team member can edit a project." },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("projects")
      .update({
        name,
        description,
        division,
        status,
        lead_member_id: leadMemberId,
        target_date: targetDate,
      })
      .eq("id", id)
      .select(
        "id, name, description, division, status, lead_member_id, target_date, created_at"
      )
      .single();

    if (error) {
      console.error("Unable to update project:", error);
      return NextResponse.json(
        { error: "Unable to update project." },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: data });
  } catch (error) {
    console.error("Update project failed:", error);
    return NextResponse.json(
      { error: "Unable to update project." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      actor_member_id?: string | null;
    };

    const id = body.id?.trim() ?? "";
    const actorMemberId = body.actor_member_id || null;

    if (!id) {
      return NextResponse.json(
        { error: "Project id is required." },
        { status: 400 }
      );
    }

    if (!actorMemberId) {
      return NextResponse.json(
        { error: "Select yourself under Working As before deleting a project." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: actor, error: actorError } = await supabase
      .from("team_members")
      .select("id, role, active")
      .eq("id", actorMemberId)
      .maybeSingle();

    if (actorError) {
      throw actorError;
    }

    if (!actor || actor.active === false) {
      return NextResponse.json(
        { error: "Only an active team member can delete a project." },
        { status: 403 }
      );
    }

    if (!["captain", "mentor", "coach"].includes(actor.role)) {
      return NextResponse.json(
        {
          error:
            "Only a captain, mentor, or coach can permanently delete a project.",
        },
        { status: 403 }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (projectError) {
      throw projectError;
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    const { count: taskCount, error: taskCountError } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id);

    if (taskCountError) {
      throw taskCountError;
    }

    if ((taskCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            `This project still has ${taskCount} live task${
              taskCount === 1 ? "" : "s"
            }. Move or delete those tasks before deleting the project.`,
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      ok: true,
      message: "Project deleted.",
      deleted_project_id: id,
      deleted_project_name: project.name,
    });
  } catch (error) {
    console.error("Delete project failed:", error);

    return NextResponse.json(
      { error: "Unable to delete project." },
      { status: 500 }
    );
  }
}
