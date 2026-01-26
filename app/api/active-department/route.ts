import { NextResponse } from "next/server";

function toPositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

// Cookie names we support (covers layout/header variants)
const COOKIE_NAMES = [
  "neris_selected_department_id",
  "selected_department_id",
  "department_id",
] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);

  const deptId = toPositiveInt(url.searchParams.get("departmentId"));
  const redirectTo = url.searchParams.get("redirect") || "/dashboard";

  const res = NextResponse.redirect(new URL(redirectTo, url.origin));

  // Prevent any intermediary caching weirdness
  res.headers.set("Cache-Control", "no-store, max-age=0");

  // If deptId is missing/invalid, clear all variants to avoid stale context
  if (!deptId) {
    for (const name of COOKIE_NAMES) {
      res.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });
    }
    return res;
  }

  // Set all variants so whichever one the header/layout is reading will work.
  for (const name of COOKIE_NAMES) {
    res.cookies.set(name, String(deptId), {
      path: "/",
      httpOnly: true, // server-readable, secure for demo
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return res;
}
