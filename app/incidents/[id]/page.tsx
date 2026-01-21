import Link from "next/link";
import IncidentDetailClient from "./ui";

type Incident = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neris_incident_id?: string | null;

  // ✅ Optional (for Incident Type / NERIS code support; safe if backend doesn't send it)
  incident_type_code?: string | number | null;
  incident_type_description?: string | null;
  neris_incident_type_code?: string | number | null;

  created_at?: string;
  updated_at?: string;
};

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id?: string | null;
};

async function fetchJson<T>(
  url: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, text };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, status: 0, text: e?.message ?? "Fetch failed" };
  }
}

function pickBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://infernointelai-backend.onrender.com"
  );
}

function asFirstString(v: string | string[] | undefined) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

async function resolveMaybePromise<T>(v: Promise<T> | T | undefined): Promise<T | undefined> {
  if (typeof v === "undefined") return undefined;
  return await v;
}

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  // Next.js 16: these may be Promises in server components
  params: Promise<{ id: string }> | { id: string };
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const backend = pickBackendBaseUrl();

  const p = await resolveMaybePromise(params);
  const sp = (await resolveMaybePromise(searchParams)) ?? {};

  const rawIncidentId = p?.id;
  const incidentIdNum = typeof rawIncidentId === "string" ? Number(rawIncidentId) : NaN;

  const rawDeptId = asFirstString(sp.departmentId);
  const departmentId = rawDeptId ? Number(rawDeptId) : NaN;

  // Preserve department context in nav links if present
  const deptQuery = Number.isFinite(departmentId) ? `?departmentId=${departmentId}` : "";

  // 1) Fetch incident directly by ID (preferred)
  let incident: Incident | null = null;
  let fetchNote: string | null = null;

  if (Number.isFinite(incidentIdNum)) {
    const incResp = await fetchJson<Incident>(`${backend}/api/v1/incidents/${incidentIdNum}`);
    if (incResp.ok) {
      incident = incResp.data;
    } else {
      fetchNote = incResp.status
        ? `Direct incident fetch failed (${incResp.status})`
        : "Direct incident fetch failed";
    }
  } else {
    fetchNote = "Invalid incident id in route params.";
  }

  // 2) Fallback: if direct fetch failed AND we have departmentId, load dept incidents and find it
  if (!incident && Number.isFinite(departmentId) && Number.isFinite(incidentIdNum)) {
    const deptIncResp = await fetchJson<Incident[]>(
      `${backend}/api/v1/departments/${departmentId}/incidents/`
    );

    if (deptIncResp.ok) {
      incident = deptIncResp.data.find((x) => Number(x.id) === incidentIdNum) ?? null;
      if (!incident) {
        fetchNote = `Incident ${incidentIdNum} not found in department ${departmentId}.`;
      }
    } else {
      fetchNote = deptIncResp.status
        ? `Department incident list fetch failed (${deptIncResp.status})`
        : "Department incident list fetch failed";
    }
  }

  // Optional: department label (best effort)
  let department: Department | null = null;
  if (incident?.department_id) {
    const deptResp = await fetchJson<Department>(
      `${backend}/api/v1/departments/${incident.department_id}`
    );
    if (deptResp.ok) department = deptResp.data;
  }

  // --------- Not Found / Error UI (polished) ----------
  if (!incident) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Incident Case File</div>
            <h1 className="text-2xl font-semibold text-slate-100">Incident not available</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/incidents${deptQuery}`}
              className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/70"
            >
              ← Back to Incidents
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/70"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-300">
          We couldn’t load this incident from the backend. If you navigated here from a department list, make sure the
          URL includes a departmentId (example: <span className="text-slate-100">?departmentId=7</span>).
        </p>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Debug</div>
              <div className="mt-1 text-xs text-slate-400">
                This block is safe for demo use, but you can remove it later.
              </div>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              Server fetch
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <InfoRow label="Backend" value={backend} />
            <InfoRow label="Raw params.id" value={String(rawIncidentId)} />
            <InfoRow label="departmentId" value={rawDeptId ? String(rawDeptId) : "not provided"} />
            <InfoRow label="Note" value={fetchNote ?? "Unknown error"} />
          </div>
        </div>
      </div>
    );
  }

  // ✅ A: Render the client detail UI (notes/tags + incident type/code field)
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Keep your top header actions consistent with the rest of the app */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          Incident Case File{" "}
          {department?.name ? (
            <>
              <span className="text-slate-600">•</span> <span className="text-slate-300">{department.name}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/incidents${deptQuery}`}
            className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/70"
          >
            ← Back to Incidents
          </Link>

          {/* Keep disabled until wired */}
          <button
            disabled
            className="rounded-md border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm text-slate-500"
            title="Phase 3: PDF export"
          >
            Export PDF (Phase 3)
          </button>
        </div>
      </div>

      <IncidentDetailClient incident={incident} departmentId={rawDeptId ?? ""} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className="mt-1 break-words text-xs text-slate-200">{value}</div>
    </div>
  );
}
