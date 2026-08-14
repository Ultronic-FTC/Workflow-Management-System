import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CapacityBody = {
  member_id?: string;
  week_start?: string;
  available_minutes?: number;
  note?: string;
  plans?: Array<{
    task_id?: string;
    planned_minutes?: number;
  }>;
};

type MemberRow = {
  id: string;
  name: string;
  role: string;
  division: string;
  sort_order: number;
};

type CapacityRow = {
  member_id: string;
  available_minutes: number;
  note: string | null;
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
  estimated_minutes: number | null;
  deadline: string | null;
  lead_member_id: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
};

type PlanRow = {
  task_id: string;
  member_id: string;
  planned_minutes: number;
};

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("week_start") ?? "";

  if (!isDate(weekStart)) {
    return NextResponse.json(
      { error: "A valid week_start date is required." },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    const [
      membersResult,
      capacityResult,
      assignmentsResult,
      tasksResult,
      projectsResult,
      plansResult,
    ] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, name, role, division, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabase
        .from("weekly_capacity")
        .select("member_id, available_minutes, note")
        .eq("week_start", weekStart),

      supabase
        .from("task_assignments")
        .select("task_id, member_id"),

      supabase
        .from("tasks")
        .select(
          "id, project_id, title, status, estimated_minutes, deadline, lead_member_id"
        )
        .neq("status", "completed")
        .neq("status", "archived")
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),

      supabase
        .from("projects")
        .select("id, name")
        .neq("status", "archived"),

      supabase
        .from("task_weekly_plans")
        .select("task_id, member_id, planned_minutes")
        .eq("week_start", weekStart),
    ]);

    const firstError =
      membersResult.error ||
      capacityResult.error ||
      assignmentsResult.error ||
      tasksResult.error ||
      projectsResult.error ||
      plansResult.error;

    if (firstError) {
      console.error("Unable to load capacity:", firstError);
      return NextResponse.json(
        { error: "Unable to load capacity." },
        { status: 500 }
      );
    }

    const members = (membersResult.data ?? []) as MemberRow[];
    const capacities = (capacityResult.data ?? []) as CapacityRow[];
    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const tasks = (tasksResult.data ?? []) as TaskRow[];
    const projects = (projectsResult.data ?? []) as ProjectRow[];
    const plans = (plansResult.data ?? []) as PlanRow[];

    const capacityByMember = new Map(
      capacities.map((capacity) => [capacity.member_id, capacity])
    );
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const planByMemberTask = new Map(
      plans.map((plan) => [
        `${plan.member_id}:${plan.task_id}`,
        plan.planned_minutes,
      ])
    );

    const assignmentsByMember = new Map<string, AssignmentRow[]>();
    for (const assignment of assignments) {
      if (!taskById.has(assignment.task_id)) {
        continue;
      }

      const existing = assignmentsByMember.get(assignment.member_id) ?? [];
      existing.push(assignment);
      assignmentsByMember.set(assignment.member_id, existing);
    }

    const rows = members.map((member) => {
      const capacity = capacityByMember.get(member.id);
      const memberAssignments = assignmentsByMember.get(member.id) ?? [];

      const assignedTasks = memberAssignments
        .map((assignment) => taskById.get(assignment.task_id))
        .filter((task): task is TaskRow => Boolean(task))
        .map((task) => {
          const plannedMinutes =
            planByMemberTask.get(`${member.id}:${task.id}`) ?? 0;
          const project = projectById.get(task.project_id);

          return {
            id: task.id,
            title: task.title,
            project_name: project?.name ?? "Unknown Project",
            status: task.status,
            estimated_minutes: task.estimated_minutes,
            deadline: task.deadline,
            is_lead: task.lead_member_id === member.id,
            planned_minutes: plannedMinutes,
          };
        });

      const plannedMinutes = assignedTasks.reduce(
        (sum, task) => sum + task.planned_minutes,
        0
      );
      const availableMinutes = capacity?.available_minutes ?? 0;
      const remainingMinutes = availableMinutes - plannedMinutes;
      const unplannedTaskCount = assignedTasks.filter(
        (task) => task.planned_minutes === 0
      ).length;
      const unestimatedTaskCount = assignedTasks.filter(
        (task) => task.estimated_minutes == null
      ).length;

      return {
        ...member,
        available_minutes: availableMinutes,
        planned_minutes: plannedMinutes,
        remaining_minutes: remainingMinutes,
        over_capacity: remainingMinutes < 0,
        workload_percent:
          availableMinutes > 0
            ? Math.round((plannedMinutes / availableMinutes) * 100)
            : plannedMinutes > 0
              ? 100
              : 0,
        unplanned_task_count: unplannedTaskCount,
        unestimated_task_count: unestimatedTaskCount,
        note: capacity?.note ?? null,
        tasks: assignedTasks,
      };
    });

    const summary = rows.reduce(
      (totals, row) => {
        totals.available_minutes += row.available_minutes;
        totals.planned_minutes += row.planned_minutes;
        totals.remaining_minutes += row.remaining_minutes;
        totals.over_capacity_count += row.over_capacity ? 1 : 0;
        totals.unplanned_task_count += row.unplanned_task_count;
        totals.unestimated_task_count += row.unestimated_task_count;
        return totals;
      },
      {
        available_minutes: 0,
        planned_minutes: 0,
        remaining_minutes: 0,
        over_capacity_count: 0,
        unplanned_task_count: 0,
        unestimated_task_count: 0,
      }
    );

    return NextResponse.json(
      { week_start: weekStart, summary, members: rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Capacity API failed:", error);
    return NextResponse.json(
      { error: "Capacity service is not configured." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CapacityBody;
    const memberId = body.member_id ?? "";
    const weekStart = body.week_start ?? "";
    const availableMinutes = Number(body.available_minutes ?? 0);
    const note = body.note?.trim() || null;
    const incomingPlans = Array.isArray(body.plans) ? body.plans : [];

    if (!memberId || !isDate(weekStart)) {
      return NextResponse.json(
        { error: "Member and week are required." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(availableMinutes) ||
      availableMinutes < 0 ||
      availableMinutes > 10080
    ) {
      return NextResponse.json(
        { error: "Available time must be between 0 and 168 hours." },
        { status: 400 }
      );
    }

    if (note && note.length > 500) {
      return NextResponse.json(
        { error: "Capacity note must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    const normalizedPlans = incomingPlans.map((plan) => ({
      task_id: plan.task_id ?? "",
      planned_minutes: Number(plan.planned_minutes ?? 0),
    }));

    for (const plan of normalizedPlans) {
      if (
        !plan.task_id ||
        !Number.isInteger(plan.planned_minutes) ||
        plan.planned_minutes < 0 ||
        plan.planned_minutes > 10080
      ) {
        return NextResponse.json(
          { error: "Each task plan must contain valid planned minutes." },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", memberId)
      .eq("active", true)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Team member was not found." },
        { status: 400 }
      );
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("task_assignments")
      .select("task_id")
      .eq("member_id", memberId);

    if (assignmentError) {
      console.error("Unable to validate capacity assignments:", assignmentError);
      return NextResponse.json(
        { error: "Unable to validate task assignments." },
        { status: 500 }
      );
    }

    const assignedTaskIds = (assignments ?? []).map((row) => row.task_id);
    let activeTaskIds = new Set<string>();

    if (assignedTaskIds.length > 0) {
      const { data: activeTasks, error: taskError } = await supabase
        .from("tasks")
        .select("id, status")
        .in("id", assignedTaskIds)
        .neq("status", "completed")
        .neq("status", "archived");

      if (taskError) {
        console.error("Unable to validate active tasks:", taskError);
        return NextResponse.json(
          { error: "Unable to validate task plans." },
          { status: 500 }
        );
      }

      activeTaskIds = new Set((activeTasks ?? []).map((task) => task.id));
    }

    for (const plan of normalizedPlans) {
      if (!activeTaskIds.has(plan.task_id)) {
        return NextResponse.json(
          { error: "Planned hours can only be entered for assigned active tasks." },
          { status: 400 }
        );
      }
    }

    const { error: capacityError } = await supabase
      .from("weekly_capacity")
      .upsert(
        {
          member_id: memberId,
          week_start: weekStart,
          available_minutes: availableMinutes,
          note,
        },
        { onConflict: "member_id,week_start" }
      );

    if (capacityError) {
      console.error("Unable to save weekly capacity:", capacityError);
      return NextResponse.json(
        { error: "Unable to save weekly capacity." },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabase
      .from("task_weekly_plans")
      .delete()
      .eq("member_id", memberId)
      .eq("week_start", weekStart);

    if (deleteError) {
      console.error("Unable to reset weekly task plans:", deleteError);
      return NextResponse.json(
        { error: "Unable to update weekly task plans." },
        { status: 500 }
      );
    }

    const rowsToInsert = normalizedPlans
      .filter((plan) => plan.planned_minutes > 0)
      .map((plan) => ({
        task_id: plan.task_id,
        member_id: memberId,
        week_start: weekStart,
        planned_minutes: plan.planned_minutes,
      }));

    if (rowsToInsert.length > 0) {
      const { error: planError } = await supabase
        .from("task_weekly_plans")
        .insert(rowsToInsert);

      if (planError) {
        console.error("Unable to save task plans:", planError);
        return NextResponse.json(
          { error: "Capacity was saved, but task plans could not be saved." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Save capacity failed:", error);
    return NextResponse.json(
      { error: "Unable to save capacity." },
      { status: 500 }
    );
  }
}
