import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET(req: NextRequest) {
  const auth = await requireDemoAuth(req);
  if (!auth.ok) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  // If your backend does NOT have /api/v1/incidents, you must call the dept-scoped route instead.
  // For now, return a helpful error so we don't "fake" it:
  return NextResponse.json(
    { detail: "Use /api/departments/{departmentId}/incidents in this app. This endpoint is not wired." },
    { status: 400 }
  );
}
