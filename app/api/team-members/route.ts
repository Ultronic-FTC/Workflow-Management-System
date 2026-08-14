import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("team_members")
      .select("id, name, role, division, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Unable to load team roster:", error);
      return NextResponse.json(
        { error: "Unable to load team roster." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { members: data ?? [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Team roster API failed:", error);
    return NextResponse.json(
      { error: "Team roster service is not configured." },
      { status: 500 }
    );
  }
}
