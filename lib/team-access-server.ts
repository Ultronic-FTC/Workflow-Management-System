import { cookies } from "next/headers";
import { ACCESS_COOKIE, hashAccessCode } from "@/lib/access";

export async function hasTeamAccess() {
  const configuredCode = process.env.TEAM_ACCESS_CODE;

  if (!configuredCode) {
    return false;
  }

  const cookieStore = await cookies();
  const actual = cookieStore.get(ACCESS_COOKIE)?.value;
  const expected = await hashAccessCode(configuredCode);

  return actual === expected;
}
