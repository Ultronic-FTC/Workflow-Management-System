type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordNotification = {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordField[];
};

export const discordColors = {
  cyan: 0x2bd0dc,
  red: 0xff4451,
  yellow: 0xf5c451,
  green: 0x7fe59c,
  blue: 0x5f8cff,
  gray: 0x8794a5,
};

function webhookUrlWithWait(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}wait=true`;
}

export function formatDiscordDeadline(value: string | null | undefined) {
  if (!value) {
    return "No deadline";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

export async function sendDiscordNotification(
  notification: DiscordNotification
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    console.warn(
      "Discord notification skipped: DISCORD_WEBHOOK_URL is not configured."
    );
    return false;
  }

  try {
    const response = await fetch(webhookUrlWithWait(webhookUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Ultronic Team Manager",
        allowed_mentions: {
          parse: [],
        },
        embeds: [
          {
            title: notification.title,
            description: notification.description,
            color: notification.color ?? discordColors.cyan,
            fields: notification.fields ?? [],
            footer: {
              text: "Ultronic Team Manager",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(
        `Discord webhook failed (${response.status}):`,
        responseText
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Discord webhook request failed:", error);
    return false;
  }
}
