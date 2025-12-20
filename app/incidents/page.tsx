// app/incidents/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IncidentApi = {
  id: number;
  department_id: number;
  occurred_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neris_incident_id: string | null;
  created_at: string;
  updated_at: string;
};

type IncidentSummary = {
  id: number;
  title: string;
  location: string;
  date: string;
  status: string;
  departmentId: number;
};

const DEFAULT_API_BASE = "https://infernointelai-backend.onrender.com";

/**
 * Uses NEXT_PUBLIC_API_BASE_URL if set in Vercel, otherwise falls back to Render URL.
 */
function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE;
}

function formatLocation(i: IncidentApi) {
  const city = i.city ?? "—";
  const state = i.state ?? "—";
  return `${city}, ${state}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function IncidentsPage() {
  const apiBase = useMemo(() => getApiBase(), []);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    // NOTE: backend convention matches departments: trailing slash
    fetch(`${apiBase}/api/v1/incidents/`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Failed to load incidents (${res.status}). ${text}`);
        }
        const data = await res.json();

        // Accept either { items: [...] } or a raw []
        const items = Array.isArray(data?.items) ? data.items : data;

        if (!Array.isArray(items)) {
          throw new Error("API returned an unexpected shape.");
        }

        const mapped: IncidentSummary[] = items.map((it: IncidentApi) => ({
          id: it.id,
          departmentId: it.department_id,
          title: it.neris_incident_id ? `Incident ${it.neris_incident_id}` : `Incident #${it.id}`,
          location: formatLocation(it),
          date: formatDate(it.occurred_at),
          status: "Active",
        }));

        setIncidents(mapped);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Could not load incidents from API.");
        setIncidents([]);
      })
      .finally(() => setLoading(false));
  }, [apiBase]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incidents</h1>
          <p className="text-xs text-slate-300">Live data from your Render backend.</p>
          <p className="mt-1 text-[11px] text-slate-500">
            API: <span className="text-slate-300">{apiBase}</span>
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:border-orange-400"
        >
          ← Back
        </Link>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading incidents from API…</p>}

      {error ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-200">
          <div className="font-semibold">Couldn’t load incidents</div>
          <div className="mt-2 whitespace-pre-wrap text-[11px] text-red-100/90">{error}</div>
          <div className="mt-3 text-[11px] text-slate-200/80">
            Quick check: open <span className="text-slate-100">{apiBase}/docs</span> and try GET{" "}
            <span className="text-slate-100">/api/v1/incidents/</span>.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
              No incidents yet. Add one in <span className="text-slate-100">/docs</span> and refresh.
            </div>
          ) : (
            incidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">{incident.title}</div>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                    {incident.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {incident.location} · {incident.date} · Dept #{incident.departmentId}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
