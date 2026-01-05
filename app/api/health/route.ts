import { NextResponse } from "next/server";

export async function GET() {
  const backend = process.env.BACKEND_URL || "https://infernointelai-backend.onrender.com";

  try {
    // Hit an endpoint that definitely exists in your backend
    const res = await fetch(`${backend}/api/v1/departments/`, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, backend },
        { status: 200 } // still 200 so UI can show status cleanly
      );
    }

    return NextResponse.json({ ok: true, backend }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "fetch failed", backend },
      { status: 200 }
    );
  }
}
