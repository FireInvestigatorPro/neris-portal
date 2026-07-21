import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET(req: NextRequest) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Auth required" }, { status: 401 });
  }

  const departmentId = req.nextUrl.searchParams.get("departmentId");
  if (!departmentId) {
    return NextResponse.json({ detail: "departmentId is required" }, { status: 400 });
  }

  const upstream = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/`;

  const res = await fetch(upstream, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
