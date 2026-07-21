import Link from "next/link";

type Incident = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neris_incident_id?: string | null;
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

function fmtWhen(iso?: string | null) {
  if (!iso) return { local: "Unknown time", utc: "Unknown time" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { local: "Unknown time", utc: "Unknown time" };
  return { local: d.toLocaleString(), utc: d.toUTCString() };
}

function buildLocation(i: Incident) {
  const parts = [i.address, i.city, i.state].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "Unknown location";
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Demo-safe NFPA-aligned field:
 * - NFPA 921 emphasizes a systematic approach and scientific method.
 * - Until you have DB support, we surface it as a read-only default.
 */
function getInvestigationMethodology() {
  return "Scientific Method (NFPA 921)";
}

/**
 * Demo-only status:
 * - Keep the UI chip consistent without claiming legal conclusions.
 * - You can later wire this to a real backend field.
 */
function getDemoStatus() {
  return "Under Investigation";
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

  // --------- Detail UI ----------
  const when = fmtWhen(incident.occurred_at);
  const location = buildLocation(incident);

  const title = incident.neris_incident_id
    ? `Incident ${incident.neris_incident_id}`
    : `Incident #${incident.id}`;

  const deptLabel =
    department?.name ?? (incident.department_id ? `Department #${incident.department_id}` : "Department");

  const status = getDemoStatus();
  const methodology = getInvestigationMethodology();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Top header / actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Incident Case File</span>
            <span className="text-slate-600">•</span>
            <Link href={`/incidents${deptQuery}`} className="text-orange-400 hover:underline">
              Incidents
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300">{title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
            <StatusPill status={status} />
          </div>

          <div className="text-sm text-slate-300">{location}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/incidents${deptQuery}`}
            className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/70"
          >
            ← Back to Incidents
          </Link>

          {/* Keep disabled until you wire it up */}
          <button
            disabled
            className="rounded-md border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm text-slate-500"
            title="Phase 3: PDF export"
          >
            Export PDF (Phase 3)
          </button>
        </div>
      </div>

      {/* Key facts */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Key facts</h2>
            <p className="mt-1 text-xs text-slate-400">
              Organized for fast demo scanning and later NFPA 921 workflow expansion.
            </p>
          </div>

          {incident.department_id ? (
            <Link
              href={`/departments/${incident.department_id}`}
              className="text-sm text-orange-400 hover:underline"
              title="Department profile"
            >
              {deptLabel} →
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FactCard label="Occurred (Local)" value={when.local} subValue={`UTC: ${when.utc}`} />
          <FactCard
            label="NEMSIS / NERIS Incident ID"
            value={incident.neris_incident_id ?? "Not provided"}
            muted={!incident.neris_incident_id}
          />
          <FactCard
            label="Department ID"
            value={incident.department_id ? String(incident.department_id) : "Not provided"}
            muted={!incident.department_id}
          />

          {/* ✅ NFPA-aligned field (real, demo-safe) */}
          <FactCard
            label="Investigation Methodology (NFPA 921)"
            value={methodology}
            subValue="Systematic approach supports courtroom credibility"
          />

          <FactCard
            label="Record Updated"
            value={incident.updated_at ? new Date(incident.updated_at).toLocaleString() : "Unknown"}
            muted={!incident.updated_at}
          />
          <FactCard
            label="Record Created"
            value={incident.created_at ? new Date(incident.created_at).toLocaleString() : "Unknown"}
            muted={!incident.created_at}
          />
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-orange-400">Investigation Notes</h3>
            <p className="mt-1 text-sm text-slate-300">
              Structure notes to separate <span className="text-slate-100">observations</span>,{" "}
              <span className="text-slate-100">analysis</span>, and{" "}
              <span className="text-slate-100">hypotheses</span> to align with NFPA 921 methodology.
            </p>
          </div>

          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            Demo-ready
          </span>
        </div>

        {/* Placeholder content area (read-only for now) */}
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-xs font-semibold text-slate-200">Suggested format</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            <li>
              <span className="text-slate-100">Observations:</span> What is directly seen / measured (no conclusions).
            </li>
            <li>
              <span className="text-slate-100">Analysis:</span> What the observations imply (supported by data).
            </li>
            <li>
              <span className="text-slate-100">Hypotheses:</span> Possible explanations to test / validate.
            </li>
          </ul>
        </div>
      </section>

      {/* Tags */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">Tags</h3>
        <p className="mt-2 text-sm text-slate-400">
          Phase 2: add structured tags (Origin Work, Evidence, Interviews, Documentation, etc.).
        </p>
      </section>

      {/* Evidence */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">Evidence & Attachments</h3>
        <p className="mt-2 text-sm text-slate-400">
          Photos, reports, and supporting documentation (Phase 2). This section is intentionally investor-friendly.
        </p>
      </section>

      {/* Bottom action */}
      <section className="flex justify-end">
        <button
          disabled
          className="cursor-not-allowed rounded-md border border-slate-800 bg-slate-900/30 px-4 py-2 text-sm text-slate-500"
          title="Phase 3: PDF export"
        >
          Export Case File (PDF)
        </button>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "Completed"
      ? "border-green-500/30 bg-green-500/15 text-green-200"
      : status === "Under Investigation"
      ? "border-amber-500/30 bg-amber-500/15 text-amber-200"
      : "border-slate-500/30 bg-slate-500/15 text-slate-200";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", cls)}>
      {status}
    </span>
  );
}

function FactCard({
  label,
  value,
  subValue,
  muted,
}: {
  label: string;
  value: string;
  subValue?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-xs font-semibold text-slate-300">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold", muted ? "text-slate-400" : "text-slate-100")}>{value}</div>
      {subValue ? <div className="mt-1 text-xs text-slate-500">{subValue}</div> : null}
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
