"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
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

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace("T", " ").replace("Z", " UTC");
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentIdStr = params?.id;
  const incidentId = Number(incidentIdStr);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [incident, setIncident] = useState<ApiIncident | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidId = useMemo(() => Number.isFinite(incidentId) && incidentId > 0, [incidentId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatusMsg(null);
      setIncident(null);
      setDepartment(null);

      if (!baseUrl) {
        setError("NEXT_PUBLIC_API_BASE_URL is not configured. Set it in Vercel env vars.");
        setLoading(false);
        return;
      }

      if (!isValidId) {
        setError(`Invalid incident id: "${incidentIdStr}"`);
        setLoading(false);
        return;
      }

      // --- Fast path: if backend supports GET /api/v1/incidents/{id} ---
      setStatusMsg("Loading incident…");
      try {
        const res = await fetch(`${baseUrl}/api/v1/incidents/${incidentId}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data = (await safeJson(res)) as ApiIncident | null;
          if (!cancelled && data) {
            setIncident(data);
          }
        } else if (res.status !== 404) {
          // Non-404 errors we surface, but still try fallback scan
          console.warn("Global incident fetch failed:", res.status);
        }
      } catch (e) {
        console.warn("Global incident fetch error:", e);
      }

      // If we already got the incident, load its department and finish.
      if (!cancelled && incident) {
        setLoading(false);
        return;
      }

      // --- Fallback: scan department incidents until we find matching ID ---
      try {
        setStatusMsg("Searching incident across departments…");

        const deptRes = await fetch(`${baseUrl}/api/v1/departments/`, { cache: "no-store" });
        if (!deptRes.ok) throw new Error(`Departments fetch failed: ${deptRes.status}`);

        const deptJson = await safeJson(deptRes);
        const deptItems = Array.isArray(deptJson?.items) ? deptJson.items : deptJson;

        if (!Array.isArray(deptItems)) throw new Error("Unexpected departments response shape.");

        const departments: Department[] = deptItems.map((d: any) => ({
          id: Number(d.id),
          name: String(d.name ?? "Unknown Department"),
          city: String(d.city ?? ""),
          state: String(d.state ?? ""),
          neris_department_id: String(d.neris_department_id ?? ""),
        }));

        // Scan departments one by one (fine for demo scale)
        for (const d of departments) {
          if (cancelled) return;

          setStatusMsg(`Checking ${d.name}…`);

          const incRes = await fetch(`${baseUrl}/api/v1/departments/${d.id}/incidents/`, {
            cache: "no-store",
          });

          if (!incRes.ok) continue;

          const incJson = await safeJson(incRes);
          const incItems = Array.isArray(incJson?.items) ? incJson.items : incJson;

          if (!Array.isArray(incItems)) continue;

          const match = incItems.find((x: any) => Number(x?.id) === incidentId) as ApiIncident | undefined;

          if (match) {
            if (!cancelled) {
              setIncident(match);
              setDepartment(d);
            }
            break;
          }
        }

        if (!cancelled && !incident) {
          setError("Incident not found. It may have been deleted, or the backend doesn’t expose it.");
        }
      } catch (e: any) {
        console.error(e);
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
  }, [baseUrl, incidentIdStr]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incident Detail</h1>
          <p className="text-xs text-slate-300">Incident ID: {incidentIdStr}</p>
        </div>

        <Link
          href="/incidents"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
        >
          ← Back to Incidents
        </Link>
      </div>

      {!baseUrl && (
        <p className="text-xs text-red-400">
          NEXT_PUBLIC_API_BASE_URL is not set. Configure it in Vercel.
        </p>
      )}

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-300">{statusMsg ?? "Loading…"}</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {!loading && incident && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-200">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-slate-100">
              {incident.neris_incident_id ? `NERIS Incident: ${incident.neris_incident_id}` : `Incident #${incident.id}`}
            </div>

            <div className="text-[11px] text-slate-400">
              Occurred: <span className="text-slate-200">{formatDateTime(incident.occurred_at)}</span>
            </div>

            <div className="text-[11px] text-slate-400">
              Location:{" "}
              <span className="text-slate-200">
                {[incident.address, incident.city, incident.state].filter(Boolean).join(", ") || "Unknown"}
              </span>
            </div>

            <div className="text-[11px] text-slate-400">
              Department ID: <span className="text-slate-200">{incident.department_id}</span>
              {department ? (
                <>
                  {" "}
                  · <span className="text-slate-200">{department.name}</span>
                </>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Created</div>
                <div className="text-xs text-slate-200">{formatDateTime(incident.created_at)}</div>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Updated</div>
                <div className="text-xs text-slate-200">{formatDateTime(incident.updated_at)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Next demo step</div>
              <div className="text-xs text-slate-200">
                Add “Incident Notes”, “NERIS pull status”, and a “Map pin” section here.
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
