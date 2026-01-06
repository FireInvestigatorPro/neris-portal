import Link from "next/link";
import { requireDemoAuth } from "../lib/auth.server";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Incident = {
  id: number;
  department_id: number;
  occurred_at: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neris_incident_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
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

export default async function DashboardPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // Protect the dashboard (your demo login)
  await requireDemoAuth();

  const backend =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://infernointelai-backend.onrender.com";

  // 1) Backend status check (direct to Render backend; does NOT require demo auth)
  const deptUrl = `${backend}/api/v1/departments/`;
  const deptResp = await fetchJson<Department[]>(deptUrl);

  const backendOnline = deptResp.ok;
  const backendStatusLabel = backendOnline
    ? "Online"
    : deptResp.status
    ? `Down (${deptResp.status})`
    : "Down";

  // 2) Departments (from backend directly)
  const departments: Department[] = deptResp.ok ? deptResp.data : [];

  // Selected department (from querystring if provided, otherwise first dept)
  const rawDeptId = props.searchParams?.departmentId;
  const departmentId =
    typeof rawDeptId === "string"
      ? Number(rawDeptId)
      : Array.isArray(rawDeptId)
      ? Number(rawDeptId[0])
      : NaN;

  const selected =
    Number.isFinite(departmentId)
      ? departments.find((d) => d.id === departmentId) ?? departments[0]
      : departments[0];

  // 3) Incidents for selected dept (from backend directly)
  let incidents: Incident[] = [];
  let incidentsError: string | null = null;

  if (selected?.id) {
    const incUrl = `${backend}/api/v1/departments/${selected.id}/incidents/`;
    const incResp = await fetchJson<Incident[]>(incUrl);
    if (incResp.ok) incidents = incResp.data;
    else incidentsError = incResp.status ? `Failed (${incResp.status})` : "Fetch failed";
  }

  const totalDepartments = departments.length;
  const totalIncidentsForDept = incidents.length;
  const latestIncident = incidents
    .slice()
    .sort((a, b) => (new Date(b.occurred_at).getTime() || 0) - (new Date(a.occurred_at).getTime() || 0))[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-300">
            Phase 1 demo: departments + incidents + guarded access.
          </p>
        </div>

        {/* Backend badge */}
        <div
          className={cls(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
            backendOnline ? "border-emerald-700/60 bg-emerald-900/20 text-emerald-200" : "border-rose-700/60 bg-rose-900/20 text-rose-200"
          )}
          title={backendOnline ? `Backend reachable: ${backend}` : `Backend not reachable: ${backend}`}
        >
          <span className={cls("h-2 w-2 rounded-full", backendOnline ? "bg-emerald-400" : "bg-rose-400")} />
          <span className="font-medium">Backend:</span>
          <span>{backendStatusLabel}</span>
        </div>
      </div>

      {/* Selected dept */}
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Selected Department</div>
            <div className="mt-1 text-lg font-semibold">
              {selected ? selected.name : "No departments yet"}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {selected ? `${selected.city}, ${selected.state}` : "Create a department to begin."}
            </div>
            {selected?.neris_department_id ? (
              <div className="mt-1 text-xs text-slate-400">
                NERIS ID: <span className="text-slate-200">{selected.neris_department_id}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/departments"
              className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm hover:border-orange-500/60 hover:text-orange-300"
            >
              Manage Departments
            </Link>
            <Link
              href="/incidents"
              className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm hover:border-orange-500/60 hover:text-orange-300"
            >
              View All Incidents
            </Link>
            {selected?.id ? (
              <Link
                href={`/incidents/new?departmentId=${selected.id}`}
                className="rounded-xl bg-gradient-to-br from-orange-500 to-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                + New Incident
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Snapshot cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Departments</div>
          <div className="mt-2 text-3xl font-semibold">{totalDepartments}</div>
          <div className="mt-2 text-sm text-slate-300">
            {totalDepartments ? "Loaded from Render database." : "Create your first department."}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Incidents (Selected Dept)</div>
          <div className="mt-2 text-3xl font-semibold">{selected ? totalIncidentsForDept : "—"}</div>
          <div className="mt-2 text-sm text-slate-300">
            {selected ? (incidentsError ? `Error: ${incidentsError}` : "Pulled from department incident endpoint.") : "Select a department."}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Latest Incident</div>
          <div className="mt-2 text-lg font-semibold">{latestIncident?.address ?? "—"}</div>
          <div className="mt-1 text-sm text-slate-300">
            {latestIncident ? `${latestIncident.city ?? ""} ${latestIncident.state ?? ""}`.trim() : "No incidents yet."}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {latestIncident ? fmtDate(latestIncident.occurred_at) : ""}
          </div>
          {latestIncident ? (
            <div className="mt-3">
              <Link
                href={`/incidents/${latestIncident.id}`}
                className="text-sm text-orange-300 hover:text-orange-200"
              >
                View incident →
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Today’s goals / punch list */}
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-semibold">Today’s Goals (Phase 1)</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Confirm demo auth protects all pages (done if you’re being redirected to /login).</li>
          <li>Dashboard shows backend status correctly (this fix).</li>
          <li>Incident Detail Page: confirm fields + timestamps + department link.</li>
          <li>Department → Incidents drill-down (next improvement after detail page).</li>
        </ul>
      </div>

      {/* Notes */}
      <div className="mt-6 text-xs text-slate-500">
        Backend used: <span className="text-slate-400">{backend}</span>
      </div>
    </div>
  );
}
