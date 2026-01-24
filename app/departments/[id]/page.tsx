"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

  incident_type_code?: number | string | null;
  incident_type?: number | string | null;
  neris_incident_type_code?: number | string | null;

  created_at?: string;
  updated_at?: string;
};

type GeoPoint = { lat: number; lon: number };

type IncidentPin = {
  incidentId: number;
  label: string;
  locationText: string;
  occurredAt?: string | null;
  point: GeoPoint;
  incident: ApiIncident;
};

type IncidentCategoryKey = "structure" | "vehicle" | "outside" | "other" | "unknown";

type HotspotCluster = {
  id: string;
  center: GeoPoint;
  count: number;
  pins: IncidentPin[];
  dominantCategory: IncidentCategoryKey;
};

type TimeRangeKey = "all" | "30" | "90" | "365";
type MapMode = "pins" | "hotspots";
type TypeFilterKey = "all" | IncidentCategoryKey;

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getIncidentTypeCode(i: ApiIncident): number | null {
  return (
    asNumber(i.incident_type_code) ??
    asNumber(i.neris_incident_type_code) ??
    asNumber(i.incident_type) ??
    null
  );
}

function classifyIncident(i: ApiIncident): IncidentCategoryKey {
  const code = getIncidentTypeCode(i);
  if (code == null) return "unknown";

  if (code >= 111 && code <= 118) return "structure";
  if (code >= 130 && code <= 138) return "vehicle";
  if (code >= 140 && code <= 170) return "outside";

  return "other";
}

function categoryMeta(key: IncidentCategoryKey) {
  switch (key) {
    case "structure":
      return {
        label: "Structure Fire",
        dot: "bg-red-500",
        pill: "border-red-500/30 bg-red-500/10 text-red-200",
        hex: "#ef4444",
      };
    case "vehicle":
      return {
        label: "Vehicle Fire",
        dot: "bg-orange-500",
        pill: "border-orange-500/30 bg-orange-500/10 text-orange-200",
        hex: "#f97316",
      };
    case "outside":
      return {
        label: "Outside Fire",
        dot: "bg-yellow-400",
        pill: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100",
        hex: "#facc15",
      };
    case "other":
      return {
        label: "Other",
        dot: "bg-blue-500",
        pill: "border-blue-500/30 bg-blue-500/10 text-blue-200",
        hex: "#3b82f6",
      };
    default:
      return {
        label: "Unknown",
        dot: "bg-slate-400",
        pill: "border-slate-500/30 bg-slate-500/10 text-slate-200",
        hex: "#94a3b8",
      };
  }
}

function CategoryPill({ incident }: { incident: ApiIncident }) {
  const key = classifyIncident(incident);
  const meta = categoryMeta(key);
  const code = getIncidentTypeCode(incident);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        meta.pill
      )}
      title="Category coloring (not severity or cause)"
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
      {code != null ? <span className="font-mono text-[10px] opacity-80">({code})</span> : null}
    </span>
  );
}

function timeRangeLabel(key: TimeRangeKey) {
  switch (key) {
    case "30":
      return "Last 30 days";
    case "90":
      return "Last 90 days";
    case "365":
      return "Last 365 days";
    default:
      return "All time";
  }
}

function timeRangeDays(key: TimeRangeKey): number | null {
  if (key === "30") return 30;
  if (key === "90") return 90;
  if (key === "365") return 365;
  return null;
}

function TimeFilterChips({
  value,
  onChange,
}: {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
}) {
  const options: TimeRangeKey[] = ["all", "30", "90", "365"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold",
              active
                ? "border-orange-400/60 bg-orange-500/10 text-orange-200"
                : "border-slate-800 bg-slate-950/30 text-slate-300 hover:border-orange-400/40 hover:text-orange-200"
            )}
            onClick={() => onChange(k)}
            aria-pressed={active}
            title={timeRangeLabel(k)}
          >
            {k === "all" ? "All" : `${k}d`}
          </button>
        );
      })}
    </div>
  );
}

function typeFilterLabel(key: TypeFilterKey) {
  if (key === "all") return "All categories";
  return categoryMeta(key).label;
}

function TypeFilterChips({
  value,
  onChange,
}: {
  value: TypeFilterKey;
  onChange: (v: TypeFilterKey) => void;
}) {
  const options: TypeFilterKey[] = ["all", "structure", "vehicle", "outside", "other", "unknown"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((k) => {
        const active = value === k;

        const pill =
          k === "all"
            ? active
              ? "border-orange-400/60 bg-orange-500/10 text-orange-200"
              : "border-slate-800 bg-slate-950/30 text-slate-300 hover:border-orange-400/40 hover:text-orange-200"
            : active
              ? cn(categoryMeta(k).pill, "border-orange-400/30")
              : "border-slate-800 bg-slate-950/30 text-slate-300 hover:border-orange-400/40 hover:text-orange-200";

        const label = k === "all" ? "All" : categoryMeta(k).label.split(" ")[0];

        return (
          <button
            key={k}
            type="button"
            className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", pill)}
            onClick={() => onChange(k)}
            aria-pressed={active}
            title={typeFilterLabel(k)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MapModeToggle({ value, onChange }: { value: MapMode; onChange: (v: MapMode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-800 bg-slate-950/30">
      {(["pins", "hotspots"] as MapMode[]).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            className={cn(
              "px-3 py-1.5 text-[11px] font-semibold",
              active ? "bg-orange-500/10 text-orange-200" : "text-slate-300 hover:text-orange-200"
            )}
            onClick={() => onChange(m)}
            aria-pressed={active}
            title={m === "pins" ? "Show incident pins" : "Show hotspot circles"}
          >
            {m === "pins" ? "Pins" : "Hotspots"}
          </button>
        );
      })}
    </div>
  );
}

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

async function geocodeToPoint(query: string): Promise<GeoPoint | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getIncidentTimestampIso(i: ApiIncident): string | null {
  return i.occurred_at ?? i.created_at ?? null;
}

function isWithinLastNDays(i: ApiIncident, days: number, nowMs: number): boolean {
  const iso = getIncidentTimestampIso(i);
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function byMostRecent(a: ApiIncident, b: ApiIncident) {
  const da = new Date(getIncidentTimestampIso(a) ?? 0).getTime();
  const db = new Date(getIncidentTimestampIso(b) ?? 0).getTime();
  return db - da;
}

function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);

  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computeClusters(pins: IncidentPin[], thresholdMeters: number): HotspotCluster[] {
  const clusters: HotspotCluster[] = [];
  const used = new Array(pins.length).fill(false);

  for (let i = 0; i < pins.length; i++) {
    if (used[i]) continue;

    const seed = pins[i];
    const group: IncidentPin[] = [seed];
    used[i] = true;

    let center: GeoPoint = { ...seed.point };
    let changed = true;

    while (changed) {
      changed = false;

      for (let j = 0; j < pins.length; j++) {
        if (used[j]) continue;

        const p = pins[j];
        const d = haversineMeters(center, p.point);

        if (d <= thresholdMeters) {
          used[j] = true;
          group.push(p);

          const avgLat = group.reduce((s, x) => s + x.point.lat, 0) / group.length;
          const avgLon = group.reduce((s, x) => s + x.point.lon, 0) / group.length;
          center = { lat: avgLat, lon: avgLon };

          changed = true;
        }
      }
    }

    const counts: Record<IncidentCategoryKey, number> = {
      structure: 0,
      vehicle: 0,
      outside: 0,
      other: 0,
      unknown: 0,
    };
    for (const p of group) counts[classifyIncident(p.incident)]++;

    const dominantCategory = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "unknown") as IncidentCategoryKey;

    clusters.push({
      id: `cluster-${i}-${group.length}`,
      center,
      count: group.length,
      pins: group,
      dominantCategory,
    });
  }

  return clusters.sort((a, b) => b.count - a.count);
}

function HotspotLeafletMap({
  center,
  pins,
  clusters,
  departmentId,
  mode,
  onHotspotClick,
}: {
  center: GeoPoint | null;
  pins: IncidentPin[];
  clusters: HotspotCluster[];
  departmentId: number;
  mode: MapMode;
  onHotspotClick: (cluster: HotspotCluster) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [leafletError, setLeafletError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cssId = "leaflet-css";
    const jsId = "leaflet-js";

    function ensureCss() {
      if (document.getElementById(cssId)) return;
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    function ensureJs() {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).L) return resolve();
        const existing = document.getElementById(jsId) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")));
          return;
        }
        const script = document.createElement("script");
        script.id = jsId;
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
        script.crossOrigin = "";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Leaflet failed to load"));
        document.body.appendChild(script);
      });
    }

    (async () => {
      try {
        ensureCss();
        await ensureJs();
        if (!cancelled) setLeafletReady(true);
      } catch (e: any) {
        if (!cancelled) setLeafletError(e?.message ?? "Leaflet load error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leafletReady) return;
    if (!mapDivRef.current) return;
    if (mapRef.current) return;

    const L = (window as any).L;
    if (!L) {
      setLeafletError("Leaflet not available.");
      return;
    }

    const initialCenter: [number, number] = center ? [center.lat, center.lon] : [39.8283, -98.5795];
    const initialZoom = center ? 12 : 4;

    const map = L.map(mapDivRef.current, { zoomControl: true, attributionControl: true }).setView(
      initialCenter,
      initialZoom
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);

    mapRef.current = map;
    layerRef.current = layer;

    return () => {
      try {
        map.remove();
      } catch {}
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [leafletReady, center]);

  useEffect(() => {
    if (!leafletReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (!center) return;

    map.setView([center.lat, center.lon], 12, { animate: true });
  }, [leafletReady, center]);

  useEffect(() => {
    if (!leafletReady) return;

    const L = (window as any).L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();

    const bounds: Array<[number, number]> = [];

    if (mode === "pins") {
      for (const p of pins) {
        const meta = categoryMeta(classifyIncident(p.incident));

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 14px; height: 14px;
              border-radius: 9999px;
              background: ${meta.hex};
              border: 2px solid rgba(15, 23, 42, 0.85);
              box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([p.point.lat, p.point.lon], { icon });
        marker.on("click", () => {
          window.location.href = `/incidents/${p.incidentId}?departmentId=${departmentId}`;
        });
        marker.addTo(layer);

        bounds.push([p.point.lat, p.point.lon]);
      }
    } else {
      for (const c of clusters) {
        const meta = categoryMeta(c.dominantCategory);
        const radiusMeters = Math.min(700, 120 + c.count * 70);

        const circle = L.circle([c.center.lat, c.center.lon], {
          radius: radiusMeters,
          color: meta.hex,
          weight: 2,
          fillColor: meta.hex,
          fillOpacity: 0.18,
        });

        const label = L.marker([c.center.lat, c.center.lon], {
          interactive: true,
          keyboard: false,
          icon: L.divIcon({
            className: "",
            html: `
              <div style="
                display:flex; align-items:center; justify-content:center;
                width: 28px; height: 28px;
                border-radius: 9999px;
                background: rgba(15,23,42,0.75);
                border: 2px solid ${meta.hex};
                color: #e2e8f0;
                font-weight: 800;
                font-size: 12px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.35);
                cursor: pointer;
              ">${c.count}</div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        });

        const safeCat = categoryMeta(c.dominantCategory).label;

        circle.bindPopup(`
          <div style="font-size:12px; line-height: 1.25;">
            <div style="font-weight:800; margin-bottom:4px;">Hotspot: ${c.count} incidents</div>
            <div style="opacity:0.85; margin-bottom:4px;">Dominant category: ${safeCat}</div>
            <div style="opacity:0.85;">Click to drill down.</div>
          </div>
        `);

        const handleClusterClick = () => {
          onHotspotClick(c);
          try {
            map.setView([c.center.lat, c.center.lon], Math.max(map.getZoom(), 14), { animate: true });
          } catch {}
        };

        circle.on("click", handleClusterClick);
        label.on("click", handleClusterClick);

        circle.addTo(layer);
        label.addTo(layer);

        bounds.push([c.center.lat, c.center.lon]);
      }
    }

    if (bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [20, 20] });
      } catch {}
    } else if (bounds.length === 1) {
      map.setView(bounds[0], mode === "pins" ? 14 : 13, { animate: true });
    }
  }, [leafletReady, pins, clusters, departmentId, mode, onHotspotClick]);

  if (leafletError) {
    return <div className="p-4 text-xs text-red-200">Map failed to load: {leafletError}</div>;
  }

  if (!leafletReady) {
    return <div className="p-4 text-xs text-slate-300">Loading interactive map…</div>;
  }

  return <div ref={mapDivRef} className="h-80 w-full" aria-label="Interactive hotspot map" />;
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

  const [timeRange, setTimeRange] = useState<TimeRangeKey>("90");
  const [mapMode, setMapMode] = useState<MapMode>("hotspots");
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>("all");

  const [deptCenter, setDeptCenter] = useState<GeoPoint | null>(null);
  const [pins, setPins] = useState<IncidentPin[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapNote, setMapNote] = useState<string | null>(null);

  const [selectedCluster, setSelectedCluster] = useState<HotspotCluster | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>(() => new Date().toISOString());

  const isValidId = useMemo(() => Number.isFinite(deptId) && deptId > 0, [deptId]);

  function resetFilters() {
    setTimeRange("90");
    setTypeFilter("all");
    setMapMode("hotspots");
    setSelectedCluster(null);
  }

  function exportBrief() {
    // Update timestamp so the PDF shows the moment you exported it
    setGeneratedAt(new Date().toISOString());
    // Let state flush to DOM before print
    setTimeout(() => {
      try {
        window.print();
      } catch {
        // no-op
      }
    }, 50);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatusMsg("Loading department…");
      setDept(null);
      setIncidents([]);

      setDeptCenter(null);
      setPins([]);
      setMapNote(null);
      setSelectedCluster(null);

      if (!isValidId) {
        setError(`Invalid department id: "${idStr}"`);
        setLoading(false);
        setStatusMsg(null);
        return;
      }

      try {
        const deptRes = await fetch(`${apiBase}/api/v1/departments/${deptId}`, { cache: "no-store" });
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

        const incRes = await fetch(`${apiBase}/api/v1/departments/${deptId}/incidents/`, { cache: "no-store" });
        if (!incRes.ok) {
          const text = await incRes.text().catch(() => "");
          throw new Error(`Failed to load incidents (${incRes.status}). ${text}`);
        }

        const incJson = await safeJson(incRes);
        const items = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;

        const list: ApiIncident[] = Array.isArray(items) ? items : [];
        if (!cancelled) setIncidents(list.slice().sort(byMostRecent));
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

  const categoryFilteredAllTime = useMemo(() => {
    if (typeFilter === "all") return incidents;
    return incidents.filter((i) => classifyIncident(i) === typeFilter);
  }, [incidents, typeFilter]);

  const count30 = useMemo(() => {
    const now = Date.now();
    return categoryFilteredAllTime.filter((i) => isWithinLastNDays(i, 30, now)).length;
  }, [categoryFilteredAllTime]);

  const count90 = useMemo(() => {
    const now = Date.now();
    return categoryFilteredAllTime.filter((i) => isWithinLastNDays(i, 90, now)).length;
  }, [categoryFilteredAllTime]);

  const timeFilteredIncidents = useMemo(() => {
    const days = timeRangeDays(timeRange);
    if (!days) return incidents;
    const nowMs = Date.now();
    return incidents.filter((i) => isWithinLastNDays(i, days, nowMs));
  }, [incidents, timeRange]);

  const filteredIncidents = useMemo(() => {
    if (typeFilter === "all") return timeFilteredIncidents;
    return timeFilteredIncidents.filter((i) => classifyIncident(i) === typeFilter);
  }, [timeFilteredIncidents, typeFilter]);

  useEffect(() => {
    if (!dept) return;

    const deptQuery = buildDeptQuery(dept);
    const incidentCandidates = filteredIncidents
      .filter((i) => Boolean(i.address || i.city || i.state))
      .slice(0, 20);

    let cancelled = false;

    (async () => {
      setMapLoading(true);
      setMapNote("Geocoding map points…");
      setSelectedCluster(null);

      try {
        if (deptQuery) {
          const center = await geocodeToPoint(deptQuery);
          if (!cancelled) setDeptCenter(center);
        }

        const builtPins: IncidentPin[] = [];
        for (const i of incidentCandidates) {
          if (cancelled) break;

          const q = buildQueryFromIncident(i);
          if (!q) continue;

          const pt = await geocodeToPoint(q);
          if (pt) {
            builtPins.push({
              incidentId: i.id,
              label: i.neris_incident_id ? String(i.neris_incident_id) : `Incident #${i.id}`,
              locationText: q,
              occurredAt: getIncidentTimestampIso(i),
              point: pt,
              incident: i,
            });
          }

          // demo-safe pacing for Nominatim
          await sleep(350);
        }

        if (!cancelled) {
          setPins(builtPins);
          const filterText = typeFilter === "all" ? "All categories" : categoryMeta(typeFilter).label;

          setMapNote(
            builtPins.length > 0
              ? `Showing ${builtPins.length} mapped incident(s) • ${timeRangeLabel(timeRange)} • ${filterText}`
              : `No mappable incident addresses found (or geocode limits) • ${timeRangeLabel(timeRange)} • ${filterText}`
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
  }, [dept, filteredIncidents, timeRange, typeFilter]);

  const clusters = useMemo(() => computeClusters(pins, 250), [pins]);
  const topCluster = clusters[0] ?? null;

  useEffect(() => {
    if (!selectedCluster) return;
    const stillExists = clusters.some((c) => c.id === selectedCluster.id);
    if (!stillExists) setSelectedCluster(null);
  }, [clusters, selectedCluster]);

  const totalIncidents = incidents.length;
  const showingIncidents = filteredIncidents.length;

  const activeFiltersText =
    `${timeRangeLabel(timeRange)} • ` + (typeFilter === "all" ? "All categories" : categoryMeta(typeFilter).label);

  const drilldownPins = useMemo(() => {
    if (!selectedCluster) return [];
    return selectedCluster.pins
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.occurredAt ?? 0).getTime();
        const tb = new Date(b.occurredAt ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, 24);
  }, [selectedCluster]);

  const deptQueryForLink = dept ? buildDeptQuery(dept) : "";
  const deptMapLink = deptQueryForLink ? osmSearchUrl(deptQueryForLink) : null;

  const generated = fmtLocalUtc(generatedAt);

  const topHotspots = useMemo(() => clusters.slice(0, 3), [clusters]);

  return (
    <section className="space-y-4">
      {/* Print styles + print-only brief */}
      <style>{`
        .print-only { display: none; }
        @media print {
          /* Hide app chrome / interactive UI on print */
          .no-print { display: none !important; }
          .print-only { display: block !important; }

          /* Make print background clean */
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Prevent awkward cut-offs */
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }

          /* Tighter page layout */
          .print-page {
            padding: 24px;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          }

          .print-title { font-size: 18px; font-weight: 800; }
          .print-subtitle { font-size: 12px; color: #334155; margin-top: 2px; }
          .print-meta { font-size: 11px; color: #475569; margin-top: 8px; }

          .print-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
          .print-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
          .print-card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 0 0 6px 0; }
          .print-value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .print-note { font-size: 11px; color: #334155; margin-top: 10px; }

          .print-list { margin-top: 10px; }
          .print-row { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid #f1f5f9; }
          .print-row:first-child { border-top: 0; }
          .print-k { font-size: 11px; color: #475569; }
          .print-v { font-size: 12px; color: #0f172a; font-weight: 600; }

          .print-footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #475569; }
        }
      `}</style>

      <div className="print-only print-page">
        <div className="print-title">InfernoIntelAI — NERIS Hotspot Brief</div>
        <div className="print-subtitle">
          {dept ? dept.name : "Department"} • {dept ? [dept.city, dept.state].filter(Boolean).join(", ") : ""}
        </div>
        <div className="print-meta">
          Generated: <strong>{generated.local}</strong> • Filters: <strong>{activeFiltersText}</strong>
          {dept?.neris_department_id ? (
            <>
              {" "}
              • NERIS Dept ID: <strong>{dept.neris_department_id}</strong>
            </>
          ) : null}
        </div>

        <div className="print-grid">
          <div className="print-card print-avoid-break">
            <h3>Volume</h3>
            <div className="print-value">{showingIncidents}</div>
            <div className="print-note">Incidents matching current filters</div>
          </div>

          <div className="print-card print-avoid-break">
            <h3>Mapped Preview</h3>
            <div className="print-value">{pins.length}</div>
            <div className="print-note">Mapped pins (demo subset)</div>
          </div>

          <div className="print-card print-avoid-break">
            <h3>Hotspots</h3>
            <div className="print-value">{clusters.length}</div>
            <div className="print-note">Cluster(s) from mapped pins</div>
          </div>

          <div className="print-card print-avoid-break">
            <h3>Trend</h3>
            <div className="print-value">
              {count30} / {count90}
            </div>
            <div className="print-note">30d vs 90d (category-aware)</div>
          </div>
        </div>

        <div className="print-card print-avoid-break" style={{ marginTop: 12 }}>
          <h3>Top hotspot</h3>
          {topCluster ? (
            <>
              <div className="print-note">
                <strong>{topCluster.count}</strong> incident(s) • Dominant category:{" "}
                <strong>{categoryMeta(topCluster.dominantCategory).label}</strong>
              </div>
              <div className="print-note">
                Hotspot location is approximate and based on geocoded preview pins.
              </div>
            </>
          ) : (
            <div className="print-note">No hotspots computed for current mapped subset.</div>
          )}
        </div>

        <div className="print-card print-avoid-break" style={{ marginTop: 12 }}>
          <h3>Hotspot drilldown</h3>
          {selectedCluster ? (
            <>
              <div className="print-note">
                Selected hotspot: <strong>{selectedCluster.count}</strong> incident(s) • Dominant:{" "}
                <strong>{categoryMeta(selectedCluster.dominantCategory).label}</strong>
              </div>

              <div className="print-list">
                {drilldownPins.slice(0, 12).map((p) => {
                  const dt = fmtLocalUtc(p.occurredAt ?? null);
                  return (
                    <div key={p.incidentId} className="print-row">
                      <div>
                        <div className="print-k">Date</div>
                        <div className="print-v">{dt.local}</div>
                      </div>
                      <div>
                        <div className="print-k">Incident</div>
                        <div className="print-v">
                          {p.label} • {categoryMeta(classifyIncident(p.incident)).label}
                        </div>
                        <div className="print-k" style={{ marginTop: 2 }}>
                          {p.locationText}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {drilldownPins.length > 12 ? (
                <div className="print-note">Showing 12 of {drilldownPins.length} incident(s) in this hotspot.</div>
              ) : null}
            </>
          ) : (
            <>
              <div className="print-note">
                No hotspot selected. Tip: select a hotspot on the map to include drilldown details.
              </div>
              {topHotspots.length > 0 ? (
                <div className="print-note">
                  Top hotspots (mapped):{" "}
                  {topHotspots
                    .map(
                      (h) =>
                        `${h.count} (${categoryMeta(h.dominantCategory).label})`
                    )
                    .join(" • ")}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="print-footer">
          NFPA-aligned note: Hotspots represent density patterns for triage and resource planning. They do not imply
          cause, origin, responsibility, or investigative conclusions. Use NFPA 921 / 1033 discipline for conclusions.
        </div>
      </div>

      {/* Screen UI */}
      <div className="no-print">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-orange-400">Department</h1>
            <p className="text-xs text-slate-300">
              Dept ID: <span className="text-slate-100">{idStr}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportBrief}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
              title="Opens the browser Print dialog (choose Save as PDF)"
            >
              Export Hotspot Brief (Print/PDF)
            </button>

            <Link
              href="/departments"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
            >
              ← Back to Departments
            </Link>
          </div>
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
              <div className="text-lg font-semibold text-slate-100">{dept.name}</div>
              <div className="mt-1 text-xs text-slate-300">
                {[dept.city, dept.state].filter(Boolean).join(", ") || "—"}{" "}
                {dept.neris_department_id ? (
                  <>
                    · <span className="text-slate-400">NERIS ID:</span>{" "}
                    <span className="text-slate-100">{dept.neris_department_id}</span>
                  </>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
                  onClick={resetFilters}
                >
                  Reset filters
                </button>

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
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">NERIS Hotspot Intelligence Map</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Hotspots indicate <span className="text-slate-200">density patterns</span> for triage and planning —
                    not cause/origin/conclusions (NFPA-aligned discipline).
                  </div>
                </div>

                <MapModeToggle
                  value={mapMode}
                  onChange={(v) => {
                    setMapMode(v);
                    if (v === "pins") setSelectedCluster(null);
                  }}
                />
              </div>

              <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/20 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Time window</div>
                    <div className="mt-1 text-[11px] text-slate-300">
                      Showing <span className="text-slate-100">{showingIncidents}</span> of{" "}
                      <span className="text-slate-100">{totalIncidents}</span> incidents
                    </div>
                  </div>
                  <TimeFilterChips value={timeRange} onChange={setTimeRange} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Category filter</div>
                    <div className="mt-1 text-[11px] text-slate-300">Active: {activeFiltersText}</div>
                  </div>
                  <TypeFilterChips value={typeFilter} onChange={setTypeFilter} />
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-slate-950/30">
                <HotspotLeafletMap
                  center={deptCenter}
                  pins={pins}
                  clusters={clusters}
                  departmentId={dept.id}
                  mode={mapMode}
                  onHotspotClick={(c) => setSelectedCluster(c)}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400">{mapNote ?? (mapLoading ? "Geocoding…" : "—")}</div>
                <div className="text-[11px] text-slate-500">
                  {mapMode === "pins"
                    ? "Pins: click a dot to open an incident."
                    : `Hotspots: ${clusters.length} cluster(s) from ${pins.length} pin(s). Click the circle or number badge to drill down.`}
                </div>
              </div>

              {mapMode === "hotspots" && selectedCluster ? (
                <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Hotspot drilldown</div>
                      <div className="mt-1 text-[11px] text-slate-300">
                        <span className="text-slate-100 font-semibold">{selectedCluster.count}</span> incident(s) •
                        Dominant:{" "}
                        <span className="text-slate-100">{categoryMeta(selectedCluster.dominantCategory).label}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
                      onClick={() => setSelectedCluster(null)}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {drilldownPins.slice(0, 12).map((p) => (
                      <Link
                        key={p.incidentId}
                        href={`/incidents/${p.incidentId}?departmentId=${dept.id}`}
                        className="block rounded-md border border-slate-800 bg-slate-950/30 p-3 hover:border-orange-400"
                        title={p.locationText}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-xs font-semibold text-slate-100">{p.label}</div>
                              <CategoryPill incident={p.incident} />
                            </div>
                            <div className="mt-1 truncate text-[11px] text-slate-400">{p.locationText}</div>
                          </div>
                          <div className="text-right text-[11px]">
                            <DateBlock iso={p.occurredAt ?? null} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {pins.length === 0 ? (
                  <div className="text-xs text-slate-300">No pinned incidents match the active filters.</div>
                ) : (
                  pins.map((p) => (
                    <Link
                      key={p.incidentId}
                      href={`/incidents/${p.incidentId}?departmentId=${dept.id}`}
                      className="block rounded-md border border-slate-800 bg-slate-950/30 p-3 hover:border-orange-400"
                      title={p.locationText}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs font-semibold text-slate-100">{p.label}</div>
                            <CategoryPill incident={p.incident} />
                          </div>
                          <div className="mt-1 truncate text-[11px] text-slate-400">{p.locationText}</div>
                        </div>
                        <div className="text-right text-[11px]">
                          <DateBlock iso={p.occurredAt ?? null} />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
