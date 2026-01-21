"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Department = {
  id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  neris_department_id?: string | null;
  created_at?: string;
  updated_at?: string;
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

function getApiBase() {
  const fallback = "https://infernointelai-backend.onrender.com";
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? fallback;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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

function joinLocation(i: ApiIncident) {
  return [i.address, i.city, i.state].filter(Boolean).join(", ") || "—";
}

function byMostRecent(a: ApiIncident, b: ApiIncident) {
  const da = new Date(a.occurred_at ?? a.created_at ?? 0).getTime();
  const db = new Date(b.occurred_at ?? b.created_at ?? 0).getTime();
  return db - da;
}

// ----------------------
// Hotspot Map helpers
// ----------------------

type GeoPoint = { lat: number; lon: number };
type IncidentPin = {
  incidentId: number;
  label: string;
  locationText: string;
  occurredAt?: string | null;
  point: GeoPoint;
};

function buildQueryFromIncident(i: ApiIncident) {
  const parts = [i.address, i.city, i.state].filter(Boolean) as string[];
  return parts.join(", ");
}

function buildDeptQuery(dept: Department) {
  const parts = [dept.city, dept.state].filter(Boolean) as string[];
  return parts.join(", ");
}

function osmSearchUrl(query: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function osmEmbedUrl(lat: number, lon: number) {
  const delta = 0.02; // bigger bbox on dept view
  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
}

async function geocodeToPoint(query: string): Promise<GeoPoint | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DepartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const idStr = params?.id;
  const deptId = Number(idStr);

  const apiBase = getApiBase();

  const [dept, setDept] = useState<Department | null>(null);
  const [incidents, setIncidents] = useState<ApiIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hotspot state
  const [deptCenter, setDeptCenter] = useState<GeoPoint | null>(null);
  const [pins, setPins] = useState<IncidentPin[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapNote, setMapNote] = useState<string | null>(null);

  const isValidId = useMemo(() => Number.isFinite(deptId) && deptId > 0, [deptId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatusMsg("Loading department…");
      setDept(null);
      setIncidents([]);

      // Reset map on dept change
      setDeptCenter(null);
      setPins([]);
      setMapNote(null);

      if (!isValidId) {
        setError(`Invalid department id: "${idStr}"`);
        setLoading(false);
        setStatusMsg(null);
        return;
      }

      try {
        const deptRes = await fetch(`${apiBase}/api/v1/departments/${deptId}`, {
          cache: "no-store",
        });
        if (!deptRes.ok) {
          const text = await deptRes.text().catch(() => "");
          throw new Error(`Failed to load department (${deptRes.status}). ${text}`);
        }

        const d = (await safeJson(deptRes)) as any;
        if (!d) throw new Error("Department returned empty response.");

        if (!cancelled) {
          setDept({
            id: Number(d.id),
            name: String(d.name ?? "Unknown Department"),
            city: d.city ?? null,
            state: d.state ?? null,
            neris_department_id: d.neris_department_id ?? null,
            created_at: d.created_at,
            updated_at: d.updated_at,
          });
        }

        setStatusMsg("Loading incidents…");

        const incRes = await fetch(`${apiBase}/api/v1/departments/${deptId}/incidents/`, {
          cache: "no-store",
        });

        if (!incRes.ok) {
          const text = await incRes.text().catch(() => "");
          throw new Error(`Failed to load incidents (${incRes.status}). ${text}`);
        }

        const incJson = await safeJson(incRes);
        const items = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;

        const list: ApiIncident[] = Array.isArray(items) ? items : [];

        if (!cancelled) {
          setIncidents(list.slice().sort(byMostRecent));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load department.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setStatusMsg(null);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, deptId, idStr, isValidId]);

  // Build hotspot map once dept + incidents are loaded
  useEffect(() => {
    if (!dept || incidents.length === 0) return;

    const deptQuery = buildDeptQuery(dept);
    const incidentCandidates = incidents
      .filter((i) => Boolean(i.address || i.city || i.state))
      .slice(0, 15); // keep demo snappy and reduce geocode calls

    let cancelled = false;

    (async () => {
      setMapLoading(true);
      setMapNote("Geocoding map points…");

      try {
        // 1) Center the map on the department city/state (best effort)
        if (deptQuery) {
          const center = await geocodeToPoint(deptQuery);
          if (!cancelled) setDeptCenter(center);
        }

        // 2) Geocode incident pins sequentially (polite to Nominatim)
        const builtPins: IncidentPin[] = [];
        for (const i of incidentCandidates) {
          if (cancelled) break;

          const q = buildQueryFromIncident(i);
          if (!q) continue;

          const pt = await geocodeToPoint(q);
          if (!pt) continue;

          builtPins.push({
            incidentId: i.id,
            label: i.neris_incident_id ? String(i.neris_incident_id) : `Incident #${i.id}`,
            locationText: q,
            occurredAt: i.occurred_at ?? i.created_at ?? null,
            point: pt,
          });
        }

        if (!cancelled) {
          setPins(builtPins);
          setMapNote(
            builtPins.length > 0
              ? `Showing ${builtPins.length} pinned incident(s) (demo limit).`
              : "No mappable incident addresses found."
          );
        }
      } catch {
        if (!cancelled) setMapNote("Map preview unavailable (geocoding failed).");
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dept, incidents]);

  const totalIncidents = incidents.length;
  const mostRecent = incidents[0] ?? null;

  const deptQueryForLink = dept ? buildDeptQuery(dept) : "";
  const deptMapLink = deptQueryForLink ? osmSearchUrl(deptQueryForLink) : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Department</h1>
          <p className="text-xs text-slate-300">
            Dept ID: <span className="text-slate-100">{idStr}</span>
          </p>
        </div>

        <Link
          href="/departments"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
        >
          ← Back to Departments
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

      {!loading && dept && (
        <>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-2">
              <div className="text-lg font-semibold text-slate-100">{dept.name}</div>

              <div className="text-xs text-slate-300">
                {[dept.city, dept.state].filter(Boolean).join(", ") || "—"}{" "}
                {dept.neris_department_id ? (
                  <>
                    · <span className="text-slate-400">NERIS ID:</span>{" "}
                    <span className="text-slate-100">{dept.neris_department_id}</span>
                  </>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Total incidents
                  </div>
                  <div className="text-xl font-semibold text-slate-100">{totalIncidents}</div>
                  <div className="text-[11px] text-slate-400">Demo DB count</div>
                </div>

                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Most recent incident
                  </div>
                  {mostRecent ? (
                    <DateBlock iso={mostRecent.occurred_at ?? mostRecent.created_at ?? null} />
                  ) : (
                    <div className="text-slate-300">—</div>
                  )}
                </div>

                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Department updated
                  </div>
                  <DateBlock iso={dept.updated_at ?? null} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/incidents?departmentId=${dept.id}`}
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
                >
                  View all incidents →
                </Link>
              </div>
            </div>
          </div>

          {/* ✅ NEW: Hotspot Map */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  NERIS Hotspot Intelligence Map
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Demo view: pin recent incidents by address. Next step: cluster into hotspot circles by density.
                </div>
              </div>

              {deptMapLink ? (
                <a
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
                  href={deptMapLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open map →
                </a>
              ) : null}
            </div>

            <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-slate-950/30">
              {deptCenter ? (
                <iframe
                  title="Department map (OpenStreetMap)"
                  className="h-80 w-full"
                  loading="lazy"
                  src={osmEmbedUrl(deptCenter.lat, deptCenter.lon)}
                />
              ) : (
                <div className="p-4 text-xs text-slate-300">
                  {mapLoading ? "Loading map preview…" : "Map preview unavailable (missing city/state)."}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400">
                {mapNote ?? (mapLoading ? "Geocoding…" : "—")}
              </div>
              <div className="text-[11px] text-slate-500">
                Pins are clickable below (map pin overlay is Phase 2).
              </div>
            </div>

            {/* Pins list (click to incident) */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pins.length === 0 ? (
                <div className="text-xs text-slate-300">
                  No pinned incidents yet (missing addresses or geocode limits).
                </div>
              ) : (
                pins.map((p) => (
                  <Link
                    key={p.incidentId}
                    href={`/incidents/${p.incidentId}?departmentId=${dept.id}`}
                    className="block rounded-md border border-slate-800 bg-slate-950/30 p-3 hover:border-orange-400"
                    title={p.locationText}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-100">{p.label}</div>
                        <div className="mt-1 text-[11px] text-slate-400">{p.locationText}</div>
                      </div>
                      <div className="text-right text-[11px]">
                        <DateBlock iso={p.occurredAt ?? null} />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="mt-3 text-[11px] text-slate-500">
              Future: convert pins into <span className="text-slate-300">hotspot circles</span> (clustered by distance),
              sized by incident count, and filtered by incident type/time range.
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Recent incidents</div>
              <div className="text-[11px] text-slate-400">Top 10</div>
            </div>

            {incidents.length === 0 ? (
              <div className="mt-3 text-xs text-slate-300">
                No incidents yet for this department.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {incidents.slice(0, 10).map((i) => (
                  <Link
                    key={i.id}
                    href={`/incidents/${i.id}?departmentId=${dept.id}`}
                    className="block rounded-md border border-slate-800 bg-slate-950/30 p-3 hover:border-orange-400"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          {i.neris_incident_id ? i.neris_incident_id : `Incident #${i.id}`}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{joinLocation(i)}</div>
                      </div>
                      <div className="text-right text-[11px]">
                        <DateBlock iso={i.occurred_at} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              Tomorrow’s “wow” upgrade for this page
            </div>
            <div className="mt-1 text-[11px] text-slate-300">
              Add filters: last 30/90 days, incident type code, and “cluster view” toggles for hotspot circles.
            </div>
          </div>
        </>
      )}
    </section>
  );
}
