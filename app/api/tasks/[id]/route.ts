import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  discordColors,
  formatDiscordDeadline,
  sendDiscordNotification,
} from "@/lib/notifications/discord";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MemberRow = {
  id: string;
  name: string;
  role: string;
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
  blocked_reason: string | null;
  evidence_required: boolean;
  evidence_type: string | null;
  evidence_location: string | null;
  submitted_for_review_at: string | null;
  completed_at: string | null;
  approved_by_member_id: string | null;
  approved_at: string | null;
  review_notes: string | null;
};

type UpdateBody = {
  action?: string;
  actor_member_id?: string | null;

  title?: string;
  description?: string | null;
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

  evidence_required?: boolean;
  evidence_type?: string | null;
  evidence_location?: string | null;

  status?: string;
  blocked_reason?: string | null;
  review_notes?: string | null;

  subtask_id?: string;
  subtask_title?: string;
  completed?: boolean;

  minutes?: number;
  work_date?: string;
  note?: string | null;
};

const reviewerRoles = new Set(["captain", "mentor", "coach"]);
const allowedPriorities = new Set(["low", "normal", "high", "critical"]);
const allowedStatuses = new Set([
  "backlog",
  "needs_assignment",
  "assigned",
  "in_progress",
  "blocked",
  "ready_for_review",
  "completed",
]);

async function getActor(
  supabase: ReturnType<typeof createAdminClient>,
  memberId: string | null | undefined
) {
  if (!memberId) {
    return null;
  }

  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, role")
    .eq("id", memberId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as MemberRow | null;
}

async function addActivity(
  supabase: ReturnType<typeof createAdminClient>,
  taskId: string,
  actorMemberId: string | null | undefined,
  action: string,
  details: Record<string, unknown> = {}
) {
  const { error } = await supabase.from("task_activity").insert({
    task_id: taskId,
    actor_member_id: actorMemberId || null,
    action,
    details,
  });

  if (error) {
    console.error("Unable to record task activity:", error);
  }
}

async function loadDetail(
  supabase: ReturnType<typeof createAdminClient>,
  taskId: string
) {
  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, project_id, category_id, title, description, status, priority, difficulty, people_needed, estimated_minutes, deadline, lead_member_id, poc_member_id, blocked_reason, evidence_required, evidence_type, evidence_location, submitted_for_review_at, completed_at, approved_by_member_id, approved_at, review_notes"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }

  if (!taskData) {
    return null;
  }

  const task = taskData as TaskRow;

  const [
    projectResult,
    categoryResult,
    assignmentsResult,
    subtasksResult,
    timeResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, division")
      .eq("id", task.project_id)
      .maybeSingle(),

    supabase
      .from("categories")
      .select("id, name, division")
      .eq("id", task.category_id)
      .maybeSingle(),

    supabase
      .from("task_assignments")
      .select("member_id, assignment_source, assigned_at")
      .eq("task_id", taskId)
      .order("assigned_at", { ascending: true }),

    supabase
      .from("subtasks")
      .select(
        "id, title, assigned_member_id, estimated_minutes, completed, completed_at, sort_order"
      )
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("time_entries")
      .select("id, member_id, work_date, minutes, note, created_at")
      .eq("task_id", taskId)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("task_activity")
      .select("id, actor_member_id, action, details, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const firstError =
    projectResult.error ||
    categoryResult.error ||
    assignmentsResult.error ||
    subtasksResult.error ||
    timeResult.error ||
    activityResult.error;

  if (firstError) {
    throw firstError;
  }

  const assignments = assignmentsResult.data ?? [];
  const timeEntries = timeResult.data ?? [];
  const activity = activityResult.data ?? [];

  const memberIds = Array.from(
    new Set(
      [
        task.lead_member_id,
        task.poc_member_id,
        task.approved_by_member_id,
        ...assignments.map((row) => row.member_id),
        ...timeEntries.map((row) => row.member_id),
        ...activity.map((row) => row.actor_member_id),
      ].filter((value): value is string => Boolean(value))
    )
  );

  const membersResult =
    memberIds.length === 0
      ? { data: [] as MemberRow[], error: null }
      : await supabase
          .from("team_members")
          .select("id, name, role")
          .in("id", memberIds);

  if (membersResult.error) {
    throw membersResult.error;
  }

  const members = (membersResult.data ?? []) as MemberRow[];
  const memberMap = new Map(members.map((member) => [member.id, member]));

  const assignedMembers = assignments.map((assignment) => ({
    member_id: assignment.member_id,
    name: memberMap.get(assignment.member_id)?.name ?? "Unknown",
    role: memberMap.get(assignment.member_id)?.role ?? "student",
    assignment_source: assignment.assignment_source,
  }));

  const decoratedTimeEntries = timeEntries.map((entry) => ({
    ...entry,
    member_name: memberMap.get(entry.member_id)?.name ?? "Unknown",
  }));

  const decoratedActivity = activity.map((entry) => ({
    ...entry,
    actor_name: entry.actor_member_id
      ? memberMap.get(entry.actor_member_id)?.name ?? "Unknown"
      : "System",
  }));

  return {
    ...task,
    project_name: projectResult.data?.name ?? "Unknown Project",
    project_division: projectResult.data?.division ?? "both",
    category_name: categoryResult.data?.name ?? "Unknown Category",
    category_division: categoryResult.data?.division ?? "operational",
    lead_name: task.lead_member_id
      ? memberMap.get(task.lead_member_id)?.name ?? "Unknown"
      : null,
    poc_name: task.poc_member_id
      ? memberMap.get(task.poc_member_id)?.name ?? "Unknown"
      : null,
    approved_by_name: task.approved_by_member_id
      ? memberMap.get(task.approved_by_member_id)?.name ?? "Unknown"
      : null,
    assignees: assignedMembers,
    subtasks: subtasksResult.data ?? [],
    time_entries: decoratedTimeEntries,
    actual_minutes: decoratedTimeEntries.reduce(
      (sum, entry) => sum + Number(entry.minutes || 0),
      0
    ),
    activity: decoratedActivity,
  };
}

export async function GET(request: Request, context: RouteContext) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const task = await loadDetail(supabase, id);

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    return NextResponse.json(
      { task },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Task detail GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load task details." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateBody;
    const action = body.action ?? "update_task";
    const supabase = createAdminClient();
    let newlyAssignedMemberIds: string[] = [];

    const actor = await getActor(supabase, body.actor_member_id);

    if (!actor) {
      return NextResponse.json(
        { error: "Select yourself under Working As before changing a task." },
        { status: 400 }
      );
    }

    const { data: existingTask, error: existingError } = await supabase
      .from("tasks")
      .select(
        "id, status, lead_member_id, people_needed, submitted_for_review_at, evidence_required, evidence_location"
      )
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    if (action === "update_task") {
      const title = body.title?.trim() ?? "";
      const projectId = body.project_id ?? "";
      const categoryId = body.category_id ?? "";
      const priority = body.priority ?? "normal";
      const peopleNeeded = Number(body.people_needed ?? 1);
      const difficulty =
        body.difficulty == null ? null : Number(body.difficulty);
      const estimatedMinutes =
        body.estimated_minutes == null
          ? null
          : Number(body.estimated_minutes);
      const leadMemberId = body.lead_member_id || null;
      const pocMemberId = body.poc_member_id || null;

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
          { error: "Invalid priority." },
          { status: 400 }
        );
      }

      if (
        !Number.isInteger(peopleNeeded) ||
        peopleNeeded < 1 ||
        peopleNeeded > 20
      ) {
        return NextResponse.json(
          { error: "People Needed must be between 1 and 20." },
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

      if (
        estimatedMinutes != null &&
        (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0)
      ) {
        return NextResponse.json(
          { error: "Estimated time cannot be negative." },
          { status: 400 }
        );
      }

      const requestedAssignees = Array.from(
        new Set(
          (body.assignee_ids ?? [])
            .filter((value): value is string => Boolean(value))
            .concat(leadMemberId ? [leadMemberId] : [])
        )
      );

      if (requestedAssignees.length > peopleNeeded) {
        return NextResponse.json(
          {
            error:
              "People Needed must be at least the number of assigned team members.",
          },
          { status: 400 }
        );
      }

      const { data: existingAssignments, error: assignmentLoadError } =
        await supabase
          .from("task_assignments")
          .select("member_id")
          .eq("task_id", id);

      if (assignmentLoadError) {
        throw assignmentLoadError;
      }

      const currentIds = new Set<string>(
        (existingAssignments ?? []).map(
          (row: { member_id: string }) => row.member_id
        )
      );
      const requestedIds = new Set<string>(requestedAssignees);

      const removeIds = [...currentIds].filter(
        (memberId) => !requestedIds.has(memberId)
      );
      const addIds = [...requestedIds].filter(
        (memberId) => !currentIds.has(memberId)
      );

      newlyAssignedMemberIds = addIds;

      if (removeIds.length > 0) {
        const { error } = await supabase
          .from("task_assignments")
          .delete()
          .eq("task_id", id)
          .in("member_id", removeIds);

        if (error) {
          throw error;
        }
      }

      if (addIds.length > 0) {
        const { error } = await supabase.from("task_assignments").insert(
          addIds.map((memberId) => ({
            task_id: id,
            member_id: memberId,
            assignment_source:
              memberId === actor.id && memberId !== leadMemberId
                ? "self"
                : "assigned",
            assigned_by_member_id: actor.id,
          }))
        );

        if (error) {
          throw error;
        }
      }

      let nextStatus = existingTask.status;

      if (!leadMemberId && existingTask.status === "assigned") {
        nextStatus = "needs_assignment";
      } else if (
        leadMemberId &&
        existingTask.status === "needs_assignment"
      ) {
        nextStatus = "assigned";
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          title,
          description: body.description?.trim() || null,
          project_id: projectId,
          category_id: categoryId,
          priority,
          difficulty,
          people_needed: peopleNeeded,
          estimated_minutes: estimatedMinutes,
          deadline: body.deadline || null,
          lead_member_id: leadMemberId,
          poc_member_id: pocMemberId,
          evidence_required: Boolean(body.evidence_required),
          evidence_type: body.evidence_required
            ? body.evidence_type?.trim() || null
            : null,
          evidence_location: body.evidence_required
            ? body.evidence_location?.trim() || null
            : null,
          status: nextStatus,
        })
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }

      await addActivity(supabase, id, actor.id, "updated_task");
    } else if (action === "self_assign") {
      if (existingTask.status === "completed") {
        return NextResponse.json(
          { error: "Completed tasks cannot accept new assignments." },
          { status: 400 }
        );
      }

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("task_assignments")
        .select("member_id")
        .eq("task_id", id);

      if (assignmentError) {
        throw assignmentError;
      }

      const assignmentIds = (assignmentRows ?? []).map((row) => row.member_id);

      if (!assignmentIds.includes(actor.id)) {
        if (assignmentIds.length >= Number(existingTask.people_needed)) {
          return NextResponse.json(
            { error: "This task has no open assignment slots." },
            { status: 400 }
          );
        }

        const { error } = await supabase.from("task_assignments").insert({
          task_id: id,
          member_id: actor.id,
          assignment_source: "self",
          assigned_by_member_id: actor.id,
        });

        if (error) {
          throw error;
        }
      }

      const updateValues: Record<string, unknown> = {};

      if (!existingTask.lead_member_id) {
        updateValues.lead_member_id = actor.id;
        updateValues.status = "assigned";
      } else if (existingTask.status === "needs_assignment") {
        updateValues.status = "assigned";
      }

      if (Object.keys(updateValues).length > 0) {
        const { error } = await supabase
          .from("tasks")
          .update(updateValues)
          .eq("id", id);

        if (error) {
          throw error;
        }
      }

      await addActivity(supabase, id, actor.id, "self_assigned");
    } else if (action === "start_work") {
      if (
        !["backlog", "needs_assignment", "assigned"].includes(
          existingTask.status
        )
      ) {
        return NextResponse.json(
          { error: "This task cannot be started from its current status." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "in_progress",
          blocked_reason: null,
          review_notes: null,
        })
        .eq("id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "started_work");
    } else if (action === "block") {
      if (existingTask.status !== "in_progress") {
        return NextResponse.json(
          { error: "Only work in progress can be marked blocked." },
          { status: 400 }
        );
      }

      const reason = body.blocked_reason?.trim() ?? "";

      if (!reason) {
        return NextResponse.json(
          { error: "A blocked task needs a reason." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "blocked",
          blocked_reason: reason,
        })
        .eq("id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "blocked", {
        reason,
      });
    } else if (action === "resume_work") {
      if (existingTask.status !== "blocked") {
        return NextResponse.json(
          { error: "Only blocked tasks can be resumed." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "in_progress",
          blocked_reason: null,
        })
        .eq("id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "resumed_work");
    } else if (action === "submit_review") {
      if (existingTask.status !== "in_progress") {
        return NextResponse.json(
          { error: "Only work in progress can be submitted for review." },
          { status: 400 }
        );
      }

      if (
        existingTask.evidence_required &&
        !existingTask.evidence_location
      ) {
        return NextResponse.json(
          {
            error:
              "This task requires evidence. Add the evidence location before submitting for review.",
          },
          { status: 400 }
        );
      }

      const { data: incompleteSubtasks, error: subtaskError } = await supabase
        .from("subtasks")
        .select("id")
        .eq("task_id", id)
        .eq("completed", false)
        .limit(1);

      if (subtaskError) {
        throw subtaskError;
      }

      if ((incompleteSubtasks ?? []).length > 0) {
        return NextResponse.json(
          {
            error:
              "Complete all subtasks before submitting this task for review.",
          },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "ready_for_review",
          submitted_for_review_at: new Date().toISOString(),
          approved_by_member_id: null,
          approved_at: null,
          completed_at: null,
          review_notes: null,
          blocked_reason: null,
        })
        .eq("id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "submitted_for_review");
    } else if (action === "approve") {
      if (!reviewerRoles.has(actor.role)) {
        return NextResponse.json(
          {
            error:
              "Only a captain, mentor, or coach can approve completed work.",
          },
          { status: 403 }
        );
      }

      if (existingTask.status !== "ready_for_review") {
        return NextResponse.json(
          { error: "Only tasks in Ready for Review can be approved." },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: now,
          approved_by_member_id: actor.id,
          approved_at: now,
          review_notes: body.review_notes?.trim() || null,
          blocked_reason: null,
        })
        .eq("id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "approved", {
        note: body.review_notes?.trim() || null,
      });
    } else if (action === "return_for_changes") {
      if (existingTask.status !== "ready_for_review") {
        return NextResponse.json(
          { error: "Only tasks in Ready for Review can be returned." },
          { status: 400 }
        );
      }

      if (!reviewerRoles.has(actor.role)) {
        return NextResponse.json(
          {
            error:
              "Only a captain, mentor, or coach can return reviewed work.",
          },
          { status: 403 }
        );
      }

      const note = body.review_notes?.trim() ?? "";

      if (!note) {
        return NextResponse.json(
          { error: "Please explain what needs to change." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "in_progress",
          review_notes: note,
          approved_by_member_id: null,
          approved_at: null,
          completed_at: null,
        })
        .eq("id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "returned_for_changes", {
        note,
      });
    } else if (action === "add_subtask") {
      const title = body.subtask_title?.trim() ?? "";

      if (!title) {
        return NextResponse.json(
          { error: "Subtask title is required." },
          { status: 400 }
        );
      }

      const { data: existingSubtasks, error: loadError } = await supabase
        .from("subtasks")
        .select("sort_order")
        .eq("task_id", id)
        .order("sort_order", { ascending: false })
        .limit(1);

      if (loadError) throw loadError;

      const nextSort = Number(existingSubtasks?.[0]?.sort_order ?? 0) + 10;

      const { error } = await supabase.from("subtasks").insert({
        task_id: id,
        title,
        sort_order: nextSort,
      });

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "added_subtask", {
        title,
      });
    } else if (action === "toggle_subtask") {
      if (!body.subtask_id) {
        return NextResponse.json(
          { error: "Subtask ID is required." },
          { status: 400 }
        );
      }

      const completed = Boolean(body.completed);

      const { error } = await supabase
        .from("subtasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", body.subtask_id)
        .eq("task_id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "updated_subtask", {
        subtask_id: body.subtask_id,
        completed,
      });
    } else if (action === "delete_subtask") {
      if (!body.subtask_id) {
        return NextResponse.json(
          { error: "Subtask ID is required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", body.subtask_id)
        .eq("task_id", id);

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "deleted_subtask", {
        subtask_id: body.subtask_id,
      });
    } else if (action === "log_time") {
      const minutes = Number(body.minutes ?? 0);
      const workDate = body.work_date || new Date().toISOString().slice(0, 10);

      if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) {
        return NextResponse.json(
          { error: "Logged time must be between 1 minute and 24 hours." },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("time_entries").insert({
        task_id: id,
        member_id: actor.id,
        work_date: workDate,
        minutes,
        note: body.note?.trim() || null,
      });

      if (error) throw error;

      await addActivity(supabase, id, actor.id, "logged_time", {
        minutes,
        work_date: workDate,
      });
    } else {
      return NextResponse.json(
        { error: "Unsupported task action." },
        { status: 400 }
      );
    }

    const task = await loadDetail(supabase, id);

    if (task) {
      if (action === "update_task" && newlyAssignedMemberIds.length > 0) {
        const { data: assignedMembers, error: assignedMemberError } =
          await supabase
            .from("team_members")
            .select("id, name")
            .in("id", newlyAssignedMemberIds);

        if (assignedMemberError) {
          console.error(
            "Unable to load newly assigned team members:",
            assignedMemberError
          );
        }

        const names = (assignedMembers ?? [])
          .map((member) => member.name)
          .filter(Boolean);

        await sendDiscordNotification({
          title: "👤 Task assignment updated",
          description: `**${task.title}**`,
          color: discordColors.blue,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Added",
              value: names.length > 0 ? names.join(", ") : "Team member",
              inline: true,
            },
            {
              name: "Changed by",
              value: actor.name,
              inline: true,
            },
          ],
        });
      } else if (action === "self_assign") {
        await sendDiscordNotification({
          title: "🙋 Self-assigned to task",
          description: `**${actor.name}** joined **${task.title}**`,
          color: discordColors.blue,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Staffing",
              value: `${task.assignees.length} / ${task.people_needed}`,
              inline: true,
            },
          ],
        });
      } else if (action === "start_work") {
        await sendDiscordNotification({
          title: "▶️ Work started",
          description: `**${actor.name}** started **${task.title}**`,
          color: discordColors.cyan,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Deadline",
              value: formatDiscordDeadline(task.deadline),
              inline: true,
            },
          ],
        });
      } else if (action === "block") {
        await sendDiscordNotification({
          title: "⛔ Task blocked",
          description: `**${task.title}**`,
          color: discordColors.red,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Blocked by",
              value: actor.name,
              inline: true,
            },
            {
              name: "Reason",
              value: task.blocked_reason || "No reason recorded",
            },
          ],
        });
      } else if (action === "resume_work") {
        await sendDiscordNotification({
          title: "🔄 Work resumed",
          description: `**${actor.name}** resumed **${task.title}**`,
          color: discordColors.cyan,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
          ],
        });
      } else if (action === "submit_review") {
        await sendDiscordNotification({
          title: "👀 Ready for review",
          description: `**${task.title}**`,
          color: discordColors.yellow,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Submitted by",
              value: actor.name,
              inline: true,
            },
            {
              name: "Lead",
              value: task.lead_name ?? "Unassigned",
              inline: true,
            },
          ],
        });
      } else if (action === "approve") {
        await sendDiscordNotification({
          title: "✅ Task completed",
          description: `**${task.title}**`,
          color: discordColors.green,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Approved by",
              value: actor.name,
              inline: true,
            },
            ...(task.review_notes
              ? [
                  {
                    name: "Review note",
                    value: task.review_notes,
                  },
                ]
              : []),
          ],
        });
      } else if (action === "return_for_changes") {
        await sendDiscordNotification({
          title: "↩️ Returned for changes",
          description: `**${task.title}**`,
          color: discordColors.red,
          fields: [
            {
              name: "Project",
              value: task.project_name,
              inline: true,
            },
            {
              name: "Reviewer",
              value: actor.name,
              inline: true,
            },
            {
              name: "Changes requested",
              value: task.review_notes || "See task review notes.",
            },
          ],
        });
      }
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Task detail PATCH failed:", error);
    return NextResponse.json(
      { error: "Unable to update task." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      actor_member_id?: string | null;
    };

    const supabase = createAdminClient();
    const actor = await getActor(supabase, body.actor_member_id);

    if (!actor) {
      return NextResponse.json(
        { error: "Select yourself under Working As before deleting a task." },
        { status: 400 }
      );
    }

    if (!reviewerRoles.has(actor.role)) {
      return NextResponse.json(
        {
          error:
            "Only a captain, mentor, or coach can permanently delete a task.",
        },
        { status: 403 }
      );
    }

    const { data: existingTask, error: existingError } = await supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const { error: deleteError } = await supabase.rpc(
      "delete_task_permanently",
      { p_task_id: id }
    );

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      ok: true,
      message: "Task deleted.",
      deleted_task_id: id,
      deleted_task_title: existingTask.title,
    });
  } catch (error) {
    console.error("Task DELETE failed:", error);

    return NextResponse.json(
      { error: "Unable to delete task." },
      { status: 500 }
    );
  }
}
