// app/incidents/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IncidentSummary = {
  id: string;
  title: string;
  location: string;
  date: string;
  status: string;
};

const fallbackIncidents: IncidentSummary[] = [
  {
    id: "demo-1",
    title: "Structure fire – multi-family dwelling",
    location: "Demo City, MA",
    date: "2025-01-15",
    status: "Placeholder",
  },
  {
    id: "demo-2",
    title: "Vehicle fire – parking structure",
    location: "Demo City, MA",
    date: "2025-02-03",
    status: "Placeholder",
  },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>(fallbackIncidents);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
      setError("API base URL is not configured; showing demo incidents.");
      return;
    }

    setLoading(true);

    fetch(`${baseUrl}/api/v1/incidents`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Non-OK response: ${res.status}`);
        }
        const data = await res.json();

        // Accept either { items: [...] } or a raw []
        const items = Array.isArray(data?.items) ? data.items : data;
        if (Array.isArray(items) && items.length > 0) {
          setIncidents(
            items.map((it: any) => ({
              id: String(it.id ?? it.incident_id ?? "unknown"),
              title: String(
                it.title ??
                  it.summary ??
                  it.incident_type ??
                  "Unnamed incident"
              ),
              location: String(
                it.location ??
                  it.city_state ??
                  it.census_tract ??
                  "Unknown location"
              ),
              date: String(it.date ?? it.incident_date ?? "Unknown date"),
              status: String(it.status ?? "Active"),
            }))
          );
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load incidents from API; showing demo incidents.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-orange-400">
        NERIS Incidents (Demo → Live)
      </h1>
      <p className="text-xs text-slate-300">
        In the live system, this page will list NERIS-derived incidents and
        hotspot clusters for your department. Right now it will try to load from
        the API and fall back to demo data if needed.
      </p>

      {loading && (
        <p className="text-xs text-slate-400">Loading incidents from API…</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {incidents.map((incident) => (
          <Link
            key={incident.id}
            href={`/incidents/${incident.id}`}
            className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100">
                {incident.title}
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                {incident.status}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {incident.location} · {incident.date}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
