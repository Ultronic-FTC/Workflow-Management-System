import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/access";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/access", request.url), {
    status: 303,
  });

  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
