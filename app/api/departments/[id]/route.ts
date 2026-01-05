import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../../_utils";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/departments/:id  -> proxies to backend GET /api/v1/departments/:id
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const bodyText = await res.text();
  try {
    const data = bodyText ? JSON.parse(bodyText) : null;
    return NextResponse.json(data, { status: res.status });
  } catch {
    // backend returned non-JSON (or empty)
    return new NextResponse(bodyText || "", {
      status: res.status,
      headers: { "content-type": "text/plain" },
    });
  }
}

// DELETE /api/departments/:id -> proxies to backend DELETE /api/v1/departments/:id
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireDemoAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const res = await fetch(`${backendBaseUrl()}/api/v1/departments/${id}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const bodyText = await res.text();
  // Return JSON if possible, otherwise return a small JSON status
  try {
    const data = bodyText ? JSON.parse(bodyText) : { ok: res.ok };
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: res.ok, raw: bodyText || "" },
      { status: res.status }
    );
  }
}
