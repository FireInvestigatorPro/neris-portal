"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Department = {
  id: number;
  name: string;
  city: string;
  state: string;
  neris_department_id: string;
};

type Incident = {
  id: number;
  occurred_at: string;
  address: string;
  city: string;
  state: string;
  neris_incident_id: string;
  department_id: number;

  // Optional fields (may or may not exist in your backend yet)
  incident_type?: string | null;
  neris_incident_type_code?: string | null;

  created_at?: string;
  updated_at?: string;
};

function parseDeptId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function safeDateMs(iso: string) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function categoryLabel(i: Incident): string {
  // Prefer a human-friendly type if present, else show a code, else fallback
  const human = (i.incident_type ?? "").trim();
  if (human) return human;

  const code = (i.neris_incident_type_code ?? "").trim();
  if (code) return `Type ${code}`;

  return "Uncategorized";
}

function categoryTone(label: string): string {
  // Lightweight tone mapping (no hard dependency on exact NERIS codes)
  const s = label.toLowerCase();

  if (s.includes("structure") || s.includes("residential") || s.includes("building")) {
    return "border-red-500/40 text-red-200 bg-red-950/30";
  }
  if (s.includes("vehicle") || s.includes("auto") || s.includes("car")) {
    return "border-amber-500/40 text-amber-200 bg-amber-950/30";
  }
  if (s.includes("outside") || s.includes("brush") || s.includes("wildland") || s.includes("grass")) {
    return "border-emerald-500/40 text-emerald-200 bg-emerald-950/30";
  }
  if (s.includes("medical") || s.includes("ems")) {
    return "border-sky-500/40 text-sky-200 bg-sky-950/30";
  }

  return "border-slate-600 text-slate-200 bg-slate-950/30";
}

function osmSearchUrl(address: string, city: string, state: string) {
  const q = `${address}, ${city}, ${state}`.trim();
  const u = new URL("https://www.openstreetmap.org/search");
  u.searchParams.set("query", q);
  return u.toString();
}

export default function IncidentsPage() {
  const searchParams = useSearchParams();

  const deptIdFromUrl = parseDeptId(searchParams.get("departmentId"));

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | null>(deptIdFromUrl);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === departmentId) ?? null,
    [departments, departmentId]
  );

  // React to departmentId changes in URL
  useEffect(() => {
    const next = parseDeptId(searchParams.get("departmentId"));
    if (next && next !== departmentId) setDepartmentId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      try {
        const r = await fetch("/api/departments", { cache: "no-store" });
        if (!r.ok) throw new Error(`Failed to load departments (${r.status})`);
        const data = (await r.json()) as Department[];

        if (cancelled) return;
        setDepartments(data);

        if (data.length && departmentId === null) {
          setDepartmentId(data[0].id);
        }

        if (data.length && departmentId !== null) {
          const exists = data.some((d) => d.id === departmentId);
          if (!exists) setDepartmentId(data[0].id);
        }
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load departments");
      }
    }

    loadDepartments();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadIncidents() {
      if (!departmentId) return;
      setLoading(true);
      setErr(null);

      try {
        const r = await fetch(`/api/incidents?departmentId=${departmentId}`, {
          cache: "no-store",
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Failed to load incidents (${r.status}). ${text}`);
        }

        const data = (await r.json()) as Incident[];
        if (cancelled) return;
        setIncidents(data);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load incidents");
        setIncidents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadIncidents();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  // ✅ Option C.1: sort most recent first
  const incidentsSorted = useMemo(() => {
    return incidents
      .slice()
      .sort((a, b) => safeDateMs(b.occurred_at) - safeDateMs(a.occurred_at));
  }, [incidents]);

  const deptIntelligenceHref = departmentId ? `/departments/${departmentId}` : "/departments";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-sm text-slate-300">
            View incidents for a selected department (most recent first).
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Department</label>
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={departmentId ?? ""}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDepartmentId(Number.isFinite(next) ? next : null);
              }}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.city}, {d.state})
                </option>
              ))}
            </select>
          </div>

          {/* Gateway CTA into hotspot intelligence */}
          <Link
            href={deptIntelligenceHref}
            className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 hover:border-orange-500/60 hover:text-orange-300"
            title="Open the department intelligence page (map + hotspots)"
          >
            View Department Intelligence →
          </Link>
        </div>
      </div>

      {selectedDept && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-300">Selected</div>
          <div className="font-semibold">{selectedDept.name}</div>
          <div className="text-sm text-slate-300">
            NERIS ID: {selectedDept.neris_department_id}
          </div>
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-4">
          <div className="font-semibold">Couldn’t load incidents</div>
          <div className="text-sm text-red-200 whitespace-pre-wrap">{err}</div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/30">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-semibold">Incident List</div>
          <div className="text-xs text-slate-400">
            {loading ? "Loading…" : `${incidentsSorted.length} incident(s)`}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-slate-300">Loading…</div>
          ) : incidentsSorted.length === 0 ? (
            <div className="text-sm text-slate-300">No incidents found.</div>
          ) : (
            <div className="space-y-3">
              {incidentsSorted.map((i) => {
                const label = categoryLabel(i);
                const tone = categoryTone(label);

                return (
                  <div
                    key={i.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* ✅ Option C.2: category pill */}
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${tone}`}
                            title="Incident category/type (demo placeholder until backend fields are wired)"
                          >
                            {label}
                          </span>

                          <div className="truncate font-semibold">
                            {i.address}, {i.city}, {i.state}
                          </div>
                        </div>

                        <div className="mt-1 text-sm text-slate-300">
                          Occurred: {new Date(i.occurred_at).toLocaleString()}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>NERIS Incident ID: {i.neris_incident_id}</span>

                          {/* ✅ Option C.3: OpenStreetMap shortcut */}
                          <a
                            className="text-orange-300 hover:text-orange-200"
                            href={osmSearchUrl(i.address, i.city, i.state)}
                            target="_blank"
                            rel="noreferrer"
                            title="Open this address in OpenStreetMap"
                          >
                            Open map ↗
                          </a>
                        </div>
                      </div>

                      <Link
                        className="shrink-0 rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500"
                        href={`/incidents/${i.id}`}
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
