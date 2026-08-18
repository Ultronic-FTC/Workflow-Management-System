import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TeamMember = {
  name: string;
  role: string;
  division: string;
  active: boolean;
};

function csvCell(value: string | boolean | null | undefined) {
  const text = value == null ? "" : String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("team_members")
      .select("name, role, division, active")
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    const members = (data ?? []) as TeamMember[];

    const lines = [
      ["Name", "Role", "Division", "Active"].map(csvCell).join(","),
      ...members.map((member) =>
        [
          member.name,
          titleCase(member.role),
          titleCase(member.division),
          member.active ? "Yes" : "No",
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    const csv = "\uFEFF" + lines.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Ultronic-Roster-${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Roster export failed:", error);

    return NextResponse.json(
      { error: "Unable to export roster." },
      { status: 500 }
    );
  }
}
