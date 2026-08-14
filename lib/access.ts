export const ACCESS_COOKIE = "ultronic_team_access";

export async function hashAccessCode(value: string) {
  const data = new TextEncoder().encode(`ultronic-team-manager:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
