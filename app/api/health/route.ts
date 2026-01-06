// app/api/health/route.ts
import { NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET() {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  // This is a "frontend health" endpoint that also tells the UI what backend it's pointed at
  return NextResponse.json({
    ok: true,
    backend: backendBaseUrl(),
  });
}
