import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MemberRow = {
  id: string;
  name: string;
  active: boolean;
};

type HistoricalRow = {
  id: string;
  source_row: number;
  member_id: string;
  work_date: string;
  category_name: string;
  project_name: string;
  task_name: string;
  minutes: number;
  work_type: string | null;
  description: string | null;
};

export async function GET(request: Request) {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const supabase = createAdminClient();

    let query = supabase
      .from("historical_work_log")
      .select(
        "id, source_row, member_id, work_date, category_name, project_name, task_name, minutes, work_type, description"
      )
      .order("work_date", { ascending: true })
      .order("source_row", { ascending: true });

    if (start) {
      query = query.gte("work_date", start);
    }

    if (end) {
      query = query.lte("work_date", end);
    }

    const [{ data: rows, error: rowsError }, { data: members, error: memberError }] =
      await Promise.all([
        query,
        supabase
          .from("team_members")
          .select("id, name, active")
          .order("name", { ascending: true }),
      ]);

    if (rowsError) {
      throw rowsError;
    }

    if (memberError) {
      throw memberError;
    }

    const memberMap = new Map(
      ((members ?? []) as MemberRow[]).map((member) => [member.id, member])
    );

    const history = ((rows ?? []) as HistoricalRow[]).map((row) => ({
      ...row,
      member_name: memberMap.get(row.member_id)?.name ?? "Unknown",
      member_active: memberMap.get(row.member_id)?.active ?? false,
      hours: Number(row.minutes) / 60,
    }));

    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Historical work GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load historical work." },
      { status: 500 }
    );
  }
}
