import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET(req: NextRequest) {
  const auth = await requireDemoAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const backend = backendBaseUrl();
  if (!backend) {
    return NextResponse.json({ ok: false, error: "missing BACKEND_URL" }, { status: 500 });
  }

  // FastAPI always has this when running
  const res = await fetch(`${backend}/openapi.json`, { cache: "no-store" });

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    backend,
  });
}
