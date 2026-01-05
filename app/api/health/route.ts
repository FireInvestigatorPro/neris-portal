import { NextResponse } from "next/server";
import { requireDemoAuthFromRequest } from "../_utils";

export async function GET(req: Request) {
  // Require demo auth (same pattern as your other API routes)
  const auth = await requireDemoAuthFromRequest(req);
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const backend = process.env.BACKEND_URL;
  if (!backend) {
    return NextResponse.json({ ok: false, detail: "BACKEND_URL is not set" }, { status: 500 });
  }

  // Prefer /health if you have it; fallback to /docs to verify backend is reachable.
  const candidates = [`${backend}/health`, `${backend}/docs`];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return NextResponse.json({ ok: true, url });
    } catch {
      // keep trying
    }
  }

  return NextResponse.json({ ok: false, detail: "Backend unreachable" }, { status: 503 });
}
