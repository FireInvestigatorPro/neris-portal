import { NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET() {
  const auth = await requireDemoAuth();
  if (!auth.ok) return auth.response;

  try {
    // Use an endpoint that always exists:
    // FastAPI serves /docs (HTML) and /openapi.json (JSON) by default.
    const res = await fetch(`${backendBaseUrl()}/openapi.json`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, status: res.status }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Fetch failed" },
      { status: 200 }
    );
  }
}
