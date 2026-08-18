import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ImpactBody = {
  actor_member_id?: string;
  impact_year?: number;
  project_name?: string;
  impact_month?: number | null;
  people_impacted?: number | null;
};

function normalizeMonth(value: number | null | undefined) {
  if (value == null) return null;
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? month
    : undefined;
}

export async function PATCH(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ImpactBody;

    const actorMemberId = body.actor_member_id?.trim() ?? "";
    const projectName = body.project_name?.trim() ?? "";
    const impactYear = Number(body.impact_year);
    const impactMonth = normalizeMonth(body.impact_month);
    const peopleImpacted =
      body.people_impacted == null ? null : Number(body.people_impacted);

    if (!actorMemberId) {
      return NextResponse.json(
        { error: "Select yourself under Working As before editing impact." },
        { status: 400 }
      );
    }

    if (!projectName) {
      return NextResponse.json(
        { error: "Project is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(impactYear) || impactYear < 2000 || impactYear > 2100) {
      return NextResponse.json(
        { error: "A valid year is required." },
        { status: 400 }
      );
    }

    if (impactMonth === undefined) {
      return NextResponse.json(
        { error: "Impact month must be Jan–Dec or One-Time." },
        { status: 400 }
      );
    }

    if (
      peopleImpacted != null &&
      (!Number.isInteger(peopleImpacted) || peopleImpacted < 0)
    ) {
      return NextResponse.json(
        { error: "People impacted must be a whole number of 0 or more." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: actor, error: actorError } = await supabase
      .from("team_members")
      .select("id, active")
      .eq("id", actorMemberId)
      .maybeSingle();

    if (actorError) throw actorError;

    if (!actor || actor.active === false) {
      return NextResponse.json(
        { error: "Only an active team member can edit impact." },
        { status: 403 }
      );
    }

    let existingQuery = supabase
      .from("project_impact")
      .select("id")
      .eq("impact_year", impactYear)
      .ilike("project_name", projectName);

    existingQuery =
      impactMonth == null
        ? existingQuery.is("impact_month", null)
        : existingQuery.eq("impact_month", impactMonth);

    const { data: existing, error: existingError } =
      await existingQuery.maybeSingle();

    if (existingError) throw existingError;

    // A blank cell removes the stored entry.
    if (peopleImpacted == null) {
      if (existing?.id) {
        const { error: deleteError } = await supabase
          .from("project_impact")
          .delete()
          .eq("id", existing.id);

        if (deleteError) throw deleteError;
      }

      return NextResponse.json({ ok: true });
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("project_impact")
        .update({
          people_impacted: peopleImpacted,
          updated_by_member_id: actorMemberId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("project_impact")
        .insert({
          impact_year: impactYear,
          project_name: projectName,
          impact_month: impactMonth,
          people_impacted: peopleImpacted,
          updated_by_member_id: actorMemberId,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Impact update failed:", error);

    return NextResponse.json(
      { error: "Unable to save project impact." },
      { status: 500 }
    );
  }
}
