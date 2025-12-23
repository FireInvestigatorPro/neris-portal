import { NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET() {
  const auth = await requireDemoAuth();
if (!auth.ok) {
  return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
}

  const r = await fetch(`${backendBaseUrl()}/api/v1/incidents/`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
