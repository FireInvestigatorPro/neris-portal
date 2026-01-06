// app/api/incidents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl, requireDemoAuth } from "../_utils";

export async function GET(req: NextRequest) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  if (!departmentId) {
    return NextResponse.json(
      { detail: "Missing required query param: departmentId" },
      { status: 400 }
    );
  }

  const url = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

// Optional: if you later add "create incident" from the UI
export async function POST(req: NextRequest) {
  const auth = await requireDemoAuth();
  if (!auth.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  if (!departmentId) {
    return NextResponse.json(
      { detail: "Missing required query param: departmentId" },
      { status: 400 }
    );
  }

  const payload = await req.json();

  const url = `${backendBaseUrl()}/api/v1/departments/${encodeURIComponent(
    departmentId
  )}/incidents/`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
