import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, hashAccessCode } from "@/lib/access";

const PUBLIC_PATHS = ["/access", "/api/access"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return NextResponse.next();
  }

  const configuredCode = process.env.TEAM_ACCESS_CODE;

  // During initial setup, do not brick the deployment if the variable
  // has not been added yet. Configure TEAM_ACCESS_CODE in Vercel before
  // storing real team data.
  if (!configuredCode) {
    return NextResponse.next();
  }

  const expected = await hashAccessCode(configuredCode);
  const actual = request.cookies.get(ACCESS_COOKIE)?.value;

  if (actual === expected) {
    return NextResponse.next();
  }

  const accessUrl = request.nextUrl.clone();
  accessUrl.pathname = "/access";
  accessUrl.search = "";
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
