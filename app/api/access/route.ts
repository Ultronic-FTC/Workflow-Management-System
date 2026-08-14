import { NextResponse } from "next/server";
import { ACCESS_COOKIE, hashAccessCode } from "@/lib/access";

export async function POST(request: Request) {
  const configuredCode = process.env.TEAM_ACCESS_CODE;

  if (!configuredCode) {
    return NextResponse.json(
      { error: "Team access has not been configured yet." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const submittedCode = typeof body?.code === "string" ? body.code : "";

  if (!submittedCode || submittedCode !== configuredCode) {
    return NextResponse.json(
      { error: "Incorrect team access code." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, await hashAccessCode(configuredCode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
