import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type UpdateBody = {
  next_competition_date?: string | null;
  actor_member_id?: string | null;
};

const editorRoles = new Set(["captain", "mentor", "coach"]);

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("team_settings")
      .select("next_competition_date, updated_at")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        next_competition_date: data?.next_competition_date ?? null,
        updated_at: data?.updated_at ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Competition date GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load competition date." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as UpdateBody;
    const actorMemberId = body.actor_member_id?.trim() || "";

    if (!actorMemberId) {
      return NextResponse.json(
        { error: "Select yourself under Working As before editing the date." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: actor, error: actorError } = await supabase
      .from("team_members")
      .select("id, name, role")
      .eq("id", actorMemberId)
      .eq("active", true)
      .maybeSingle();

    if (actorError) {
      throw actorError;
    }

    if (!actor) {
      return NextResponse.json(
        { error: "Selected team member was not found." },
        { status: 400 }
      );
    }

    if (!editorRoles.has(actor.role)) {
      return NextResponse.json(
        {
          error:
            "Only a captain, mentor, or coach can change the competition date.",
        },
        { status: 403 }
      );
    }

    const nextDate = body.next_competition_date?.trim() || null;

    if (nextDate && !isValidDateString(nextDate)) {
      return NextResponse.json(
        { error: "Competition date must use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("team_settings")
      .upsert(
        {
          id: "default",
          next_competition_date: nextDate,
          updated_by_member_id: actor.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("next_competition_date, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      next_competition_date: data.next_competition_date,
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error("Competition date PATCH failed:", error);
    return NextResponse.json(
      { error: "Unable to update competition date." },
      { status: 500 }
    );
  }
}
