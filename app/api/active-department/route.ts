import { NextResponse } from "next/server";

function toPositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const deptId = toPositiveInt(url.searchParams.get("departmentId"));
  const redirectTo = url.searchParams.get("redirect") || "/dashboard";

  // Always redirect, even if bad input (demo-friendly)
  const res = NextResponse.redirect(new URL(redirectTo, url.origin));

  if (!deptId) {
    // If deptId is missing/invalid, clear cookie to avoid stale context
    res.cookies.set("neris_selected_department_id", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
    return res;
  }

  // Set active department cookie (used by app/layout.tsx)
  res.cookies.set("neris_selected_department_id", String(deptId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
