import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type HistoryRow = {
  work_date: string;
  category_name: string;
  project_name: string;
  task_name: string;
  work_type: string | null;
  description: string | null;
  minutes: number;
};

function activityKey(row: HistoryRow) {
  return [
    row.work_date,
    row.category_name,
    row.project_name,
    row.task_name,
    row.work_type ?? "",
    row.description ?? "",
  ].join("||");
}

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("historical_work_log")
      .select(
        "work_date, category_name, project_name, task_name, work_type, description, minutes"
      )
      .order("work_date", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as HistoryRow[];
    const activities = new Set(rows.map(activityKey));
    const totalMinutes = rows.reduce(
      (sum, row) => sum + Number(row.minutes || 0),
      0
    );

    return NextResponse.json(
      {
        historical_completed_count: activities.size,
        historical_row_count: rows.length,
        historical_hours: totalMinutes / 60,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Historical work summary failed:", error);

    return NextResponse.json(
      { error: "Unable to load historical work summary." },
      { status: 500 }
    );
  }
}
