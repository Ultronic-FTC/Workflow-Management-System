import { NextResponse } from "next/server";
import { hasTeamAccess } from "@/lib/team-access-server";
import {
  discordColors,
  sendDiscordNotification,
} from "@/lib/notifications/discord";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasTeamAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = Boolean(process.env.DISCORD_WEBHOOK_URL?.trim());

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        error: "DISCORD_WEBHOOK_URL is not configured in Vercel.",
      },
      { status: 500 }
    );
  }

  const sent = await sendDiscordNotification({
    title: "🔔 Notifications connected",
    description:
      "Ultronic Team Manager can now post task workflow notifications to this channel.",
    color: discordColors.cyan,
    fields: [
      {
        name: "Status",
        value: "Discord webhook test successful",
      },
    ],
  });

  if (!sent) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The webhook is configured, but Discord rejected the test message. Check Vercel logs.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Discord notification sent.",
  });
}
