"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Department = {
  id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  neris_department_id?: string | null;
};

type ApiIncident = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neris_incident_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function joinLocation(inc: ApiIncident) {
  return [inc.address, inc.city, inc.state].filter(Boolean).join(", ") || "—";
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getApiBase() {
  const fallback = "https://infernointelai-backend.onrender.com";
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? fallback;
}

function fmtLocalUtc(iso?: string | null) {
  if (!iso) return { local: "—", utc: "—" };

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { local: String(iso), utc: String(iso) };

  const local = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(d);

  const utc = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(d);

  return { local, utc: `${utc} UTC` };
}

function DateBlock({ iso }: { iso?: string | null }) {
  const { local, utc } = fmtLocalUtc(iso);
  return (
    <div className="leading-tight">
      <div className="text-slate-200">{local}</div>
      <div className="text-[10px] text-slate-400">{utc}</div>
    </div>
  );
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const incidentIdStr = params?.id;
  const incidentId = Number(incidentIdStr);

  const departmentIdParam = searchParams?.get("departmentId");
  const departmentId = departmentIdParam ? Number(departmentIdParam) : null;

  const apiBase = getApiBase();

  const [incident, setIncident] = useState<ApiIncident | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidIncidentId = useMemo(
    () => Number.isFinite(incidentId) && incidentId > 0,
    [incidentId]
  );

  const isValidDepartmentId = useMemo(
    () => departmentId !== null && Number.isFinite(departmentId) && departmentId > 0,
    [departmentId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatusMsg(null);
      setIncident(null);
      setDepartment(null);

      if (!isValidIncidentId) {
        setError(`Invalid incident id: "${incidentIdStr}"`);
        setLoading(false);
        return;
      }

      // 1) Best path: if we have departmentId, fetch that department’s incidents and find the match.
      if (isValidDepartmentId && departmentId) {
        try {
          setStatusMsg("Loading incident from department…");

          const deptRes = await fetch(`${apiBase}/api/v1/departments/${departmentId}`, {
            cache: "no-store",
          });
          if (deptRes.ok) {
            const d = (await safeJson(deptRes)) as any;
            if (!cancelled && d) {
              setDepartment({
                id: Number(d.id),
                name: String(d.name ?? "Unknown Department"),
                city: d.city ?? null,
                state: d.state ?? null,
                neris_department_id: d.neris_department_id ?? null,
              });
            }
          }

          const incRes = await fetch(
            `${apiBase}/api/v1/departments/${departmentId}/incidents/`,
            { cache: "no-store" }
          );

          if (!incRes.ok) {
            const text = await incRes.text().catch(() => "");
            throw new Error(`Failed to load incidents (${incRes.status}). ${text}`);
          }

          const incJson = await safeJson(incRes);
          const items = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;

          if (!Array.isArray(items)) throw new Error("Unexpected incidents response shape.");

          const match = items.find((x: any) => Number(x?.id) === incidentId) as
            | ApiIncident
            | undefined;

          if (!match) throw new Error("Incident not found in that department.");

          if (!cancelled) {
            setIncident(match);
            setLoading(false);
            setStatusMsg(null);
          }
          return;
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message ?? "Failed to load incident from department.");
            setLoading(false);
            setStatusMsg(null);
          }
          return;
        }
      }

      // 2) Optional fast path: if backend supports GET /api/v1/incidents/{id}
      try {
        setStatusMsg("Loading incident…");

        const res = await fetch(`${apiBase}/api/v1/incidents/${incidentId}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data = (await safeJson(res)) as ApiIncident | null;
          if (!cancelled && data) {
            setIncident(data);

            const deptRes = await fetch(`${apiBase}/api/v1/departments/${data.department_id}`, {
              cache: "no-store",
            });
            if (deptRes.ok) {
              const d = (await safeJson(deptRes)) as any;
              if (!cancelled && d) {
                setDepartment({
                  id: Number(d.id),
                  name: String(d.name ?? "Unknown Department"),
                  city: d.city ?? null,
                  state: d.state ?? null,
                  neris_department_id: d.neris_department_id ?? null,
                });
              }
            }

            setLoading(false);
            setStatusMsg(null);
            return;
          }
        }
      } catch {
        // ignore and try scan fallback
      }

      // 3) Demo-scale fallback: scan departments and search incidents for the ID
      try {
        setStatusMsg("Searching incident across departments…");

        const deptRes = await fetch(`${apiBase}/api/v1/departments/`, { cache: "no-store" });
        if (!deptRes.ok) throw new Error(`Departments fetch failed: ${deptRes.status}`);

        const deptJson = await safeJson(deptRes);
        const deptItems = Array.isArray((deptJson as any)?.items) ? (deptJson as any).items : deptJson;

        if (!Array.isArray(deptItems)) throw new Error("Unexpected departments response shape.");

        const departments: Department[] = deptItems.map((d: any) => ({
          id: Number(d.id),
          name: String(d.name ?? "Unknown Department"),
          city: d.city ?? null,
          state: d.state ?? null,
          neris_department_id: d.neris_department_id ?? null,
        }));

        let foundIncident: ApiIncident | null = null;
        let foundDept: Department | null = null;

        for (const d of departments) {
          if (cancelled) return;

          setStatusMsg(`Checking ${d.name}…`);

          const incRes = await fetch(`${apiBase}/api/v1/departments/${d.id}/incidents/`, {
            cache: "no-store",
          });
          if (!incRes.ok) continue;

          const incJson = await safeJson(incRes);
          const incItems = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;
          if (!Array.isArray(incItems)) continue;

          const match = incItems.find((x: any) => Number(x?.id) === incidentId) as
            | ApiIncident
            | undefined;

          if (match) {
            foundIncident = match;
            foundDept = d;
            break;
          }
        }

        if (!cancelled) {
          if (!foundIncident) {
            setError("Incident not found. It may have been deleted, or not accessible.");
          } else {
            setIncident(foundIncident);
            setDepartment(foundDept);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load incident.");
      } finally {
        if (!cancelled) {
          setStatusMsg(null);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentIdStr]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incident Detail</h1>
          <p className="text-xs text-slate-300">
            Incident ID: <span className="text-slate-100">{incidentIdStr}</span>
            {isValidDepartmentId && departmentId ? (
              <>
                {" "}
                · Dept ID: <span className="text-slate-100">{departmentId}</span>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href="/incidents"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
        >
          ← Back to Incidents
        </Link>
      </div>

      <div className="text-[11px] text-slate-500">
        Backend: <span className="text-slate-300">{apiBase}</span>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-300">{statusMsg ?? "Loading…"}</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-xs text-red-300 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {!loading && incident && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-200">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-semibold text-slate-100">
              {incident.neris_incident_id
                ? `NERIS Incident: ${incident.neris_incident_id}`
                : `Incident #${incident.id}`}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Occurred</div>
                <DateBlock iso={incident.occurred_at} />
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Location</div>
                <div className="text-slate-200">{joinLocation(incident)}</div>
              </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Department</div>
              <div className="text-slate-200">
                {department ? (
                  <>
                    <Link
                      href={`/departments/${department.id}`}
                      className="hover:text-orange-300 underline underline-offset-2"
                    >
                      {department.name}
                    </Link>{" "}
                    <span className="text-slate-400">(ID {department.id})</span>
                  </>
                ) : (
                  <>ID {incident.department_id}</>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Created</div>
                <DateBlock iso={incident.created_at} />
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Updated</div>
                <DateBlock iso={incident.updated_at} />
              </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Next demo add-ons</div>
              <div className="mt-1 text-[11px] text-slate-300">
                Tomorrow: add panels for <span className="text-slate-100">Notes</span>,{" "}
                <span className="text-slate-100">Tags</span>, and{" "}
                <span className="text-slate-100">Attachments</span> (even if attachments are “mock”).
                Those three make this feel enterprise immediately.
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
