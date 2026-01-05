import { NextResponse } from "next/server";
import { requireDemoAuth } from "../_utils";

export async function GET(req: Request) {
  // Require demo auth (same pattern as your other API routes)
  const auth = await requireDemoAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
