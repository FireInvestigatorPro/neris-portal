import { NextRequest, NextResponse } from "next/server";
import { requireDemoAuth } from "../_utils";

export async function GET(req: NextRequest) {
  const auth = await requireDemoAuth(req);

  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
