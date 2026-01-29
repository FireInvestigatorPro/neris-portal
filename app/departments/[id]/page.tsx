"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * InfernoIntelAI — Department Hotspot Intelligence Page
 * Demo-polish mindset:
 * - Works with minimal backend fields
 * - NFPA-aligned language: hotspot/density ≠ cause/origin conclusion
 * - Investor-ready: print/export brief + AI Assist (AFG/SAFER/CRR drafts)
 *
 * NOTE: This page is intentionally client-side (Leaflet + local draft text).
 */

// -----------------------------
// Types
// -----------------------------

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
  occurred_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  department_id: number;
  neris_incident_id?: string | null;
  incident_type_code?: string | null;
};

type GeoPoint = { lat: number; lon: number };

type IncidentPin = {
  incidentId: number;
  label: string;
  addressLine: string;
  occurredAt: string | null;
  lat: number;
  lon: number;
  categoryKey: TypeFilterKey;
};

type HotspotCluster = {
  id: string;
  center: GeoPoint;
  radiusMeters: number;
  count: number;
  dominantCategory: TypeFilterKey;
  pins: IncidentPin[];
};

type MapMode = "pins" | "hotspots";

type TimeRangeKey = "30" | "90" | "180" | "365" | "all";

type TypeFilterKey =
  | "all"
  // Core demo categories (NERIS-ish “type buckets”)
  | "fire"
  | "ems"
  | "hazmat"
  | "service"
  | "false_alarm"
  | "other";

type GrantMode = "AFG" | "SAFER" | "CRR";

// -----------------------------
// Config / Utilities
// -----------------------------

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getApiBase() {
  // Same pattern you’ve used elsewhere — keep stable for Vercel.
  const env = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (env) return env.replace(/\/+$/, "");
  return "";
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function fmtLocalUtc(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { local: iso, utc: iso };
  return {
    local: d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    utc: d.toUTCString(),
  };
}

function normalizeAddressParts(parts: Array<string | null | undefined>) {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function buildDeptQuery(dept: Department) {
  return normalizeAddressParts([dept.name, dept.city ?? null, dept.state ?? null]);
}

function osmSearchUrl(q: string) {
  const u = new URL("https://www.openstreetmap.org/search");
  u.searchParams.set("query", q);
  return u.toString();
}

function incidentAddressLine(i: ApiIncident) {
  return normalizeAddressParts([i.address, i.city, i.state]);
}

function timeRangeLabel(k: TimeRangeKey) {
  switch (k) {
    case "30":
      return "Last 30 days";
    case "90":
      return "Last 90 days";
    case "180":
      return "Last 180 days";
    case "365":
      return "Last 365 days";
    case "all":
      return "All time";
  }
}

function rangeStartDate(timeRange: TimeRangeKey) {
  if (timeRange === "all") return null;
  const now = new Date();
  const days = Number(timeRange);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return start;
}

/**
 * Demo category mapping.
 * In a real build we’ll map exact NERIS incident codes → a controlled taxonomy.
 */
function classifyIncident(i: ApiIncident): TypeFilterKey {
  // If you have a real NERIS incident_type_code, map it here.
  const t = (i.incident_type_code ?? "").toLowerCase();

  if (t.includes("fire")) return "fire";
  if (t.includes("ems") || t.includes("medical")) return "ems";
  if (t.includes("haz")) return "hazmat";
  if (t.includes("service") || t.includes("assist")) return "service";
  if (t.includes("false") || t.includes("alarm")) return "false_alarm";

  // Soft fallback based on presence of neris id (demo only)
  return "other";
}

function categoryMeta(k: TypeFilterKey) {
  switch (k) {
    case "fire":
      return { label: "Fire", pinColor: "#ef4444" };
    case "ems":
      return { label: "EMS", pinColor: "#22c55e" };
    case "hazmat":
      return { label: "HazMat", pinColor: "#a855f7" };
    case "service":
      return { label: "Service", pinColor: "#38bdf8" };
    case "false_alarm":
      return { label: "False Alarm", pinColor: "#f59e0b" };
    case "other":
      return { label: "Other", pinColor: "#94a3b8" };
    case "all":
    default:
      return { label: "All categories", pinColor: "#e2e8f0" };
  }
}

// -----------------------------
// Geocoding (Nominatim / OSM)
// -----------------------------

/**
 * Nominatim is rate limited. Demo-safe approach:
 * - Small batches
 * - Cache in localStorage
 */
function geocodeCacheKey(q: string) {
  return `geocode:v1:${q.toLowerCase()}`;
}

function readGeocodeCache(q: string): GeoPoint | null {
  try {
    const raw = localStorage.getItem(geocodeCacheKey(q));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lat !== "number" || typeof parsed.lon !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGeocodeCache(q: string, p: GeoPoint) {
  try {
    localStorage.setItem(geocodeCacheKey(q), JSON.stringify(p));
  } catch {
    // ignore
  }
}

async function geocodeAddress(q: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  const cached = typeof window !== "undefined" ? readGeocodeCache(q) : null;
  if (cached) return cached;

  // Nominatim usage policy: provide a valid UA and keep volume low.
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      // This is a demo app; still be polite.
      "Accept-Language": "en",
    },
    signal,
  });

  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as any;
  const first = Array.isArray(data) ? data[0] : null;
  const lat = first?.lat ? Number(first.lat) : NaN;
  const lon = first?.lon ? Number(first.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const p = { lat, lon };
  try {
    writeGeocodeCache(q, p);
  } catch {}
  return p;
}

// -----------------------------
// Hotspot clustering (simple, stable demo approach)
// -----------------------------

function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);

  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function computeClusters(pins: IncidentPin[], thresholdMeters: number): HotspotCluster[] {
  // Greedy clustering (demo-safe, predictable).
  const unused = pins.slice();
  const clusters: HotspotCluster[] = [];

  while (unused.length) {
    const seed = unused.shift()!;
    const group = [seed];

    // Pull in pins close to seed; also allow chaining (simple approach).
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = unused.length - 1; i >= 0; i--) {
        const p = unused[i];
        const closeToAny = group.some((g) => haversineMeters({ lat: g.lat, lon: g.lon }, { lat: p.lat, lon: p.lon }) <= thresholdMeters);
        if (closeToAny) {
          group.push(p);
          unused.splice(i, 1);
          changed = true;
        }
      }
    }

    // Compute center
    const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const avgLon = group.reduce((s, p) => s + p.lon, 0) / group.length;

    // Compute max radius
    const center: GeoPoint = { lat: avgLat, lon: avgLon };
    const radius = Math.max(
      120,
      group.reduce((mx, p) => Math.max(mx, haversineMeters(center, { lat: p.lat, lon: p.lon })), 0) + 80
    );

    // Dominant category
    const counts = new Map<TypeFilterKey, number>();
    for (const p of group) counts.set(p.categoryKey, (counts.get(p.categoryKey) ?? 0) + 1);
    let dominant: TypeFilterKey = "other";
    let best = -1;
    for (const [k, v] of counts.entries()) {
      if (v > best) {
        best = v;
        dominant = k;
      }
    }

    clusters.push({
      id: `c_${seed.incidentId}_${group.length}_${Math.round(avgLat * 1000)}_${Math.round(avgLon * 1000)}`,
      center,
      radiusMeters: radius,
      count: group.length,
      dominantCategory: dominant,
      pins: group,
    });
  }

  // Sort: biggest first
  clusters.sort((a, b) => b.count - a.count);
  return clusters;
}

// -----------------------------
// UI Components (small, local)
// -----------------------------

function TimeFilterChips({
  value,
  onChange,
}: {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
}) {
  const opts: Array<{ key: TimeRangeKey; label: string }> = [
    { key: "30", label: "30d" },
    { key: "90", label: "90d" },
    { key: "180", label: "180d" },
    { key: "365", label: "365d" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            value === o.key
              ? "border-orange-400/60 bg-orange-500/10 text-orange-200"
              : "border-slate-800 bg-slate-950/20 text-slate-200 hover:border-slate-700"
          )}
          aria-pressed={value === o.key}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TypeFilterChips({
  value,
  onChange,
}: {
  value: TypeFilterKey;
  onChange: (v: TypeFilterKey) => void;
}) {
  const opts: Array<{ key: TypeFilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "fire", label: "Fire" },
    { key: "ems", label: "EMS" },
    { key: "hazmat", label: "HazMat" },
    { key: "service", label: "Service" },
    { key: "false_alarm", label: "False Alarm" },
    { key: "other", label: "Other" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            value === o.key
              ? "border-orange-400/60 bg-orange-500/10 text-orange-200"
              : "border-slate-800 bg-slate-950/20 text-slate-200 hover:border-slate-700"
          )}
          aria-pressed={value === o.key}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MapModeToggle({
  value,
  onChange,
}: {
  value: MapMode;
  onChange: (v: MapMode) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-800 bg-slate-950/20">
      <button
        type="button"
        onClick={() => onChange("hotspots")}
        className={cn(
          "px-3 py-2 text-xs font-semibold",
          value === "hotspots" ? "bg-orange-500/20 text-orange-200" : "text-slate-200 hover:bg-slate-950/40"
        )}
        aria-pressed={value === "hotspots"}
        title="Hotspot circles"
      >
        Hotspots
      </button>
      <button
        type="button"
        onClick={() => onChange("pins")}
        className={cn(
          "px-3 py-2 text-xs font-semibold",
          value === "pins" ? "bg-orange-500/20 text-orange-200" : "text-slate-200 hover:bg-slate-950/40"
        )}
        aria-pressed={value === "pins"}
        title="Individual pins"
      >
        Pins
      </button>
    </div>
  );
}

// -----------------------------
// AI Assist: Grant / CRR drafts
// -----------------------------

type GrantNarrativeInputs = {
  departmentName: string;
  cityState: string;
  timeWindowLabel: string;
  categoriesLabel: string;
  mappedIncidentsCount: number;
  hotspotsCount: number;
  topHotspotCount: number;
  trend30: number;
  trend90: number;
  nfpaNote: string;
};

function buildAfgNarrative(i: GrantNarrativeInputs) {
  return [
    `AFG Narrative Draft (Demo “AI Assist”)`,
    ``,
    `Department: ${i.departmentName}${i.cityState ? ` (${i.cityState})` : ""}`,
    `Window: ${i.timeWindowLabel} • Filter: ${i.categoriesLabel}`,
    ``,
    `Problem Statement`,
    `${i.departmentName} has identified repeat incident density patterns within our response area using NERIS Hotspot Intelligence. During the ${i.timeWindowLabel} window, the system mapped ${i.mappedIncidentsCount} incident address(es) for analysis and identified ${i.hotspotsCount} hotspot area(s). The leading hotspot contains approximately ${i.topHotspotCount} incident(s) in close proximity, indicating concentrated demand that strains resources and increases operational risk.`,
    ``,
    `Project Impact`,
    `AFG investment will strengthen operational readiness and reduce risk in these demand zones by improving response capability, supporting firefighter safety, and enabling more effective deployment planning. Hotspot intelligence will also help leadership target training and prevention efforts where repeat activity is observed.`,
    ``,
    `Data & Evaluation`,
    `We will track performance using incident volume trends and hotspot metrics. Current reference: ${i.trend30} incidents in the last 30 days vs ${i.trend90} in the last 90 days (category-aware). We will monitor repeat-location density, response outcomes, and readiness indicators over time.`,
    ``,
    `NFPA-aligned note`,
    i.nfpaNote,
  ].join("\n");
}

function buildSaferNarrative(i: GrantNarrativeInputs) {
  return [
    `SAFER Narrative Draft (Demo “AI Assist”)`,
    ``,
    `Department: ${i.departmentName}${i.cityState ? ` (${i.cityState})` : ""}`,
    `Window: ${i.timeWindowLabel} • Filter: ${i.categoriesLabel}`,
    ``,
    `Staffing Need Justification`,
    `${i.departmentName} experiences concentrated incident activity in specific zones as shown by NERIS Hotspot Intelligence. During the ${i.timeWindowLabel} window, ${i.hotspotsCount} hotspot area(s) were identified from ${i.mappedIncidentsCount} mapped incident address(es). The leading hotspot contains approximately ${i.topHotspotCount} incident(s), indicating repeat demand that can increase fatigue, extend response times, and elevate risk when staffing is constrained.`,
    ``,
    `Operational Impact`,
    `Additional staffing supports safe, effective operations and helps ensure reliable coverage during repeat-demand periods. Improved staffing strengthens the department’s ability to meet workload surges, manage simultaneous incidents, and sustain training and prevention activities tied to these hotspot zones.`,
    ``,
    `Measurement`,
    `We will track incident workload trends and hotspot counts as a repeat-demand proxy. Current reference: ${i.trend30} incidents in the last 30 days vs ${i.trend90} in the last 90 days. We will also monitor response time stability and repeat-location reduction over time.`,
    ``,
    `NFPA-aligned note`,
    i.nfpaNote,
  ].join("\n");
}

function buildCrrBrief(i: GrantNarrativeInputs) {
  return [
    `CRR Executive Brief – Draft (Demo “AI Assist”)`,
    ``,
    `Department: ${i.departmentName}${i.cityState ? ` (${i.cityState})` : ""}`,
    `Window: ${i.timeWindowLabel} • Filter: ${i.categoriesLabel}`,
    ``,
    `Community Risk Reduction (CRR) Summary`,
    `${i.departmentName} is observing geographically concentrated incident activity during the ${i.timeWindowLabel} window, with ${i.hotspotsCount} hotspot area(s) identified from ${i.mappedIncidentsCount} mapped incident address(es) in the current view. The leading hotspot contains approximately ${i.topHotspotCount} incident(s), suggesting repeat-demand zones where focused prevention, inspection support, and public education can deliver outsized impact.`,
    ``,
    `Recommended CRR Actions (select & tailor)`,
    `• Targeted smoke/CO alarm outreach in hotspot zones`,
    `• Focused inspections / code enforcement coordination for repeat locations`,
    `• Public education aligned to incident mix (cooking, electrical, heating, outdoor burning)`,
    `• Pre-plan updates for high-frequency addresses and critical infrastructure`,
    `• Partner outreach (schools, senior housing, multifamily property managers)`,
    ``,
    `Outcome Metrics (simple + investor-friendly)`,
    `• Repeat-location incident reduction`,
    `• Hotspot count and intensity trending over time`,
    `• Response time stability in peak periods`,
    `• Severity indicators (e.g., working fire rate / transport rate) where available`,
    ``,
    `NFPA-aligned note`,
    i.nfpaNote,
  ].join("\n");
}

function GrantNarrativePanel({
  departmentName,
  cityState,
  timeWindowLabel,
  categoriesLabel,
  mappedIncidentsCount,
  hotspotsCount,
  topHotspotCount,
  trend30,
  trend90,
}: {
  departmentName: string;
  cityState: string;
  timeWindowLabel: string;
  categoriesLabel: string;
  mappedIncidentsCount: number;
  hotspotsCount: number;
  topHotspotCount: number;
  trend30: number;
  trend90: number;
}) {
  const storageKey = useMemo(() => `inferno:grantDraft:${departmentName}`, [departmentName]);

  const [mode, setMode] = useState<GrantMode>("AFG");
  const [draft, setDraft] = useState<string>("");

  const nfpaNote =
    "Hotspot intelligence describes density patterns for triage and planning; it does not indicate cause/origin or investigative conclusions (NFPA-aligned discipline).";

  const inputs: GrantNarrativeInputs = useMemo(
    () => ({
      departmentName,
      cityState,
      timeWindowLabel,
      categoriesLabel,
      mappedIncidentsCount,
      hotspotsCount,
      topHotspotCount,
      trend30,
      trend90,
      nfpaNote,
    }),
    [
      departmentName,
      cityState,
      timeWindowLabel,
      categoriesLabel,
      mappedIncidentsCount,
      hotspotsCount,
      topHotspotCount,
      trend30,
      trend90,
    ]
  );

  useEffect(() => {
    // Load saved draft
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setDraft(saved);
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    // Auto-generate if empty
    if (draft.trim().length > 0) return;

    const generated =
      mode === "AFG" ? buildAfgNarrative(inputs) : mode === "SAFER" ? buildSaferNarrative(inputs) : buildCrrBrief(inputs);

    setDraft(generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, inputs]);

  useEffect(() => {
    // Persist
    try {
      localStorage.setItem(storageKey, draft);
    } catch {
      // ignore
    }
  }, [storageKey, draft]);

  function regen() {
    const generated =
      mode === "AFG" ? buildAfgNarrative(inputs) : mode === "SAFER" ? buildSaferNarrative(inputs) : buildCrrBrief(inputs);
    setDraft(generated);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">AI Assist — Grant / CRR Draft</div>
          <div className="mt-1 text-[11px] text-slate-400">
            Generates editable AFG/SAFER justification language and a CRR executive brief from the current hotspot filters + counts.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-800 bg-slate-950/20">
            <button
              type="button"
              onClick={() => setMode("AFG")}
              className={cn(
                "px-3 py-1 text-xs font-semibold",
                mode === "AFG"
                  ? "bg-orange-500/20 text-orange-200"
                  : "bg-slate-950/20 text-slate-200 hover:bg-slate-950/40"
              )}
              aria-pressed={mode === "AFG"}
              title="AFG draft"
            >
              AFG
            </button>
            <button
              type="button"
              onClick={() => setMode("SAFER")}
              className={cn(
                "px-3 py-1 text-xs font-semibold",
                mode === "SAFER"
                  ? "bg-orange-500/20 text-orange-200"
                  : "bg-slate-950/20 text-slate-200 hover:bg-slate-950/40"
              )}
              aria-pressed={mode === "SAFER"}
              title="SAFER draft"
            >
              SAFER
            </button>
            <button
              type="button"
              onClick={() => setMode("CRR")}
              className={cn(
                "px-3 py-1 text-xs font-semibold",
                mode === "CRR"
                  ? "bg-orange-500/20 text-orange-200"
                  : "bg-slate-950/20 text-slate-200 hover:bg-slate-950/40"
              )}
              aria-pressed={mode === "CRR"}
              title="CRR brief"
            >
              CRR
            </button>
          </div>

          <button
            type="button"
            className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
            onClick={regen}
            title="Regenerate draft"
          >
            Regenerate
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
            onClick={copy}
            title="Copy draft to clipboard"
          >
            Copy
          </button>
        </div>
      </div>

      <textarea
        className="mt-3 h-60 w-full resize-none rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your generated draft will appear here…"
      />
      <div className="mt-2 text-[11px] text-slate-500">Saved locally to this browser for demo reliability.</div>
    </div>
  );
}

// -----------------------------
// Leaflet map (loaded via CDN for demo simplicity)
// -----------------------------

/**
 * Map with optional external "focus center" (for Top Hotspots Select).
 * Avoids refactors: accept a point and setView when it changes.
 */
function HotspotLeafletMap({
  center,
  focusCenter,
  pins,
  clusters,
  departmentId,
  mode,
  onHotspotClick,
}: {
  center: GeoPoint | null;
  focusCenter: GeoPoint | null;
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

  // Init map
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

    const map = L.map(mapDivRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(initialCenter, initialZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      // OSM tiles
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;
  }, [leafletReady, center]);

  // Focus center (Top Hotspots select)
  useEffect(() => {
    if (!leafletReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (!focusCenter) return;

    try {
      map.setView([focusCenter.lat, focusCenter.lon], Math.max(map.getZoom(), 14), { animate: true });
    } catch {
      // ignore
    }
  }, [leafletReady, focusCenter]);

  // Render markers/circles
  useEffect(() => {
    if (!leafletReady) return;
    const map = mapRef.current;
    const layer = layerRef.current;
    const L = (window as any).L;
    if (!map || !layer || !L) return;

    layer.clearLayers();

    const bounds: Array<[number, number]> = [];

    if (mode === "pins") {
      for (const p of pins) {
        const meta = categoryMeta(p.categoryKey);
        const marker = L.circleMarker([p.lat, p.lon], {
          radius: 7,
          color: meta.pinColor,
          weight: 2,
          fillColor: meta.pinColor,
          fillOpacity: 0.9,
        });

        const when = p.occurredAt ? fmtLocalUtc(p.occurredAt).local : "—";
        marker.bindPopup(`
          <div style="font-size:12px; line-height: 1.25;">
            <div style="font-weight:700; margin-bottom:4px;">${p.label}</div>
            <div style="opacity:0.85; margin-bottom:2px;">${p.addressLine}</div>
            <div style="opacity:0.75;">${when}</div>
          </div>
        `);

        marker.on("click", () => {
          // Let Next handle routing; we just open popup.
        });

        marker.addTo(layer);
        bounds.push([p.lat, p.lon]);
      }
    } else {
      for (const c of clusters) {
        const meta = categoryMeta(c.dominantCategory);
        const circle = L.circle([c.center.lat, c.center.lon], {
          radius: c.radiusMeters,
          color: meta.pinColor,
          weight: 2,
          fillColor: meta.pinColor,
          fillOpacity: 0.16,
        });

        // Label badge (count)
        const label = L.marker([c.center.lat, c.center.lon], {
          interactive: true,
          icon: L.divIcon({
            className: "",
            html: `<div style="
              width:28px; height:28px; border-radius:999px;
              display:flex; align-items:center; justify-content:center;
              border:2px solid ${meta.pinColor};
              background: rgba(2,6,23,0.80);
              color: #e2e8f0;
              font-weight: 800;
              font-size: 12px;
              box-shadow: 0 6px 18px rgba(0,0,0,0.35);
            ">${c.count}</div>`,
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

    // Fit to data if no focusCenter
    if (!focusCenter) {
      if (bounds.length >= 2) {
        try {
          map.fitBounds(bounds, { padding: [20, 20] });
        } catch {}
      } else if (bounds.length === 1) {
        try {
          map.setView(bounds[0], mode === "pins" ? 14 : 13, { animate: true });
        } catch {}
      }
    }
  }, [leafletReady, pins, clusters, departmentId, mode, onHotspotClick, focusCenter]);

  if (leafletError) {
    return <div className="p-4 text-xs text-red-200">Map failed to load: {leafletError}</div>;
  }

  if (!leafletReady) {
    return <div className="p-4 text-xs text-slate-300">Loading interactive map…</div>;
  }

  return <div ref={mapDivRef} className="h-80 w-full" aria-label="Interactive hotspot map" />;
}

// -----------------------------
// Page
// -----------------------------

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

  // used by Top Hotspots list to push map focus without refactor
  const [focusCenter, setFocusCenter] = useState<GeoPoint | null>(null);

  const [generatedAt, setGeneratedAt] = useState<string>(() => new Date().toISOString());

  const isValidId = useMemo(() => Number.isFinite(deptId) && deptId > 0, [deptId]);

  function resetFilters() {
    setTimeRange("90");
    setTypeFilter("all");
    setMapMode("hotspots");
    setSelectedCluster(null);
    setFocusCenter(null);
  }

  function exportBrief() {
    setGeneratedAt(new Date().toISOString());
    setTimeout(() => {
      try {
        window.print();
      } catch {}
    }, 50);
  }

  // Load dept + incidents from backend
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
      setFocusCenter(null);

      if (!isValidId) {
        setError(`Invalid department id: "${idStr}"`);
        setLoading(false);
        setStatusMsg(null);
        return;
      }

      try {
        const deptRes = await fetch(`${apiBase}/api/v1/departments/${deptId}`, { cache: "no-store" });
        if (!deptRes.ok) {
          const t = await deptRes.text().catch(() => "");
          throw new Error(`Failed to load department (${deptRes.status}). ${t}`);
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
        const incRes = await fetch(`${apiBase}/api/v1/incidents?department_id=${deptId}`, { cache: "no-store" });
        if (!incRes.ok) {
          const t = await incRes.text().catch(() => "");
          throw new Error(`Failed to load incidents (${incRes.status}). ${t}`);
        }
        const data = (await safeJson(incRes)) as any;

        const list: ApiIncident[] = Array.isArray(data)
          ? data.map((x: any) => ({
              id: Number(x.id),
              occurred_at: x.occurred_at ?? null,
              address: x.address ?? null,
              city: x.city ?? null,
              state: x.state ?? null,
              department_id: Number(x.department_id),
              neris_incident_id: x.neris_incident_id ?? null,
              incident_type_code: x.incident_type_code ?? null,
            }))
          : [];

        if (!cancelled) {
          setIncidents(list);
          setStatusMsg(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Unknown error");
          setStatusMsg(null);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, deptId, idStr, isValidId]);

  // Apply time + type filters
  const filteredIncidents = useMemo(() => {
    const start = rangeStartDate(timeRange);
    return incidents.filter((i) => {
      if (typeFilter !== "all") {
        const c = classifyIncident(i);
        if (c !== typeFilter) return false;
      }
      if (start) {
        const ts = i.occurred_at ? new Date(i.occurred_at).getTime() : NaN;
        if (!Number.isFinite(ts)) return false;
        if (ts < start.getTime()) return false;
      }
      return true;
    });
  }, [incidents, timeRange, typeFilter]);

  // Trend counts (simple for demo)
  const count30 = useMemo(() => {
    const start = rangeStartDate("30")!;
    return incidents.filter((i) => {
      if (typeFilter !== "all" && classifyIncident(i) !== typeFilter) return false;
      const ts = i.occurred_at ? new Date(i.occurred_at).getTime() : NaN;
      if (!Number.isFinite(ts)) return false;
      return ts >= start.getTime();
    }).length;
  }, [incidents, typeFilter]);

  const count90 = useMemo(() => {
    const start = rangeStartDate("90")!;
    return incidents.filter((i) => {
      if (typeFilter !== "all" && classifyIncident(i) !== typeFilter) return false;
      const ts = i.occurred_at ? new Date(i.occurred_at).getTime() : NaN;
      if (!Number.isFinite(ts)) return false;
      return ts >= start.getTime();
    }).length;
  }, [incidents, typeFilter]);

  // Geocode department and incidents (demo-safe)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      if (!dept) return;

      setMapLoading(true);
      setMapNote("Geocoding…");

      try {
        // Dept center
        const deptQ = buildDeptQuery(dept);
        const deptP = deptQ ? await geocodeAddress(deptQ, controller.signal) : null;
        if (!cancelled) setDeptCenter(deptP);

        // Incident pins (limit to reduce rate-limit risk)
        const toGeocode = filteredIncidents.slice(0, 40);

        const builtPins: IncidentPin[] = [];
        for (const inc of toGeocode) {
          if (cancelled) break;

          const q = incidentAddressLine(inc);
          if (!q) continue;

          const p = await geocodeAddress(q, controller.signal);
          if (!p) continue;

          const cKey = typeFilter === "all" ? classifyIncident(inc) : typeFilter;

          builtPins.push({
            incidentId: inc.id,
            label: `Incident #${inc.id}`,
            addressLine: q,
            occurredAt: inc.occurred_at,
            lat: p.lat,
            lon: p.lon,
            categoryKey: cKey,
          });

          // small delay for politeness (demo)
          await new Promise((r) => setTimeout(r, 120));
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
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dept, filteredIncidents, timeRange, typeFilter]);

  const clusters = useMemo(() => computeClusters(pins, 250), [pins]);
  const topCluster = clusters[0] ?? null;

  useEffect(() => {
    if (!selectedCluster) return;
    const stillExists = clusters.some((c) => c.id === selectedCluster.id);
    if (!stillExists) {
      setSelectedCluster(null);
      setFocusCenter(null);
    }
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

  function selectHotspot(c: HotspotCluster) {
    setMapMode("hotspots");
    setSelectedCluster(c);
    setFocusCenter(c.center);
    try {
      document.getElementById("hotspot-map-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  }

  const cityState = dept ? [dept.city, dept.state].filter(Boolean).join(", ") : "";

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <section className="space-y-4">
      {/* Print styles + print-only brief */}
      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }

          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }

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

        <div className="print-list">
          <div className="print-row">
            <div className="print-k">Top hotspot</div>
            <div className="print-v">
              {topCluster ? `${topCluster.count} incidents (dominant: ${categoryMeta(topCluster.dominantCategory).label})` : "—"}
            </div>
          </div>
          <div className="print-row">
            <div className="print-k">NFPA note</div>
            <div className="print-v">
              Hotspots indicate density patterns for triage and planning — not cause/origin/conclusions (NFPA-aligned discipline).
            </div>
          </div>
        </div>

        <div className="print-footer">
          Demo artifact. Future versions will add validated NERIS mappings, confidence scoring, and export packages for grant and CRR workflows.
        </div>
      </div>

      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-slate-100">
              {dept ? dept.name : "Department"}
              {cityState ? <span className="text-slate-400"> • {cityState}</span> : null}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              Department ID <span className="font-mono text-slate-200">{deptId}</span>
              {dept?.neris_department_id ? (
                <>
                  {" "}
                  • NERIS Dept ID <span className="font-mono text-slate-200">{dept.neris_department_id}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
            >
              ← Back to Dashboard
            </Link>

            {deptMapLink ? (
              <a
                href={deptMapLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
                title="Open in OpenStreetMap"
              >
                Open in OSM ↗
              </a>
            ) : null}

            <button
              type="button"
              onClick={exportBrief}
              className="rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500"
              title="Print / Export brief"
            >
              Export Brief (PDF)
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-900/40 bg-red-950/40 p-4 text-sm text-red-100">
            <div className="font-semibold">Error</div>
            <div className="mt-1 text-red-200">{error}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
            {statusMsg ?? "Loading…"}
          </div>
        ) : null}

        {!loading && dept ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Incidents</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-100">{totalIncidents}</div>
                <div className="mt-1 text-xs text-slate-400">Total incidents loaded</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Filtered view</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-100">{showingIncidents}</div>
                <div className="mt-1 text-xs text-slate-400">{activeFiltersText}</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Mapped pins</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-100">{pins.length}</div>
                <div className="mt-1 text-xs text-slate-400">Geocoded incident address subset (demo)</div>
              </div>
            </div>

            {/* AI Assist panel (AFG/SAFER/CRR) */}
            <GrantNarrativePanel
              departmentName={dept.name}
              cityState={cityState}
              timeWindowLabel={timeRangeLabel(timeRange)}
              categoriesLabel={typeFilter === "all" ? "All categories" : categoryMeta(typeFilter).label}
              mappedIncidentsCount={pins.length}
              hotspotsCount={clusters.length}
              topHotspotCount={clusters[0]?.count ?? 0}
              trend30={count30}
              trend90={count90}
            />

            {/* Map panel */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">NERIS Hotspot Intelligence Map</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Hotspots indicate <span className="text-slate-200">density patterns</span> for triage and planning — not
                    cause/origin/conclusions (NFPA-aligned discipline).
                  </div>
                </div>

                <MapModeToggle
                  value={mapMode}
                  onChange={(v) => {
                    setMapMode(v);
                    if (v === "pins") {
                      setSelectedCluster(null);
                      setFocusCenter(null);
                    }
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

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    <span className="text-slate-200 font-semibold">Pin colors:</span>{" "}
                    Fire (red), EMS (green), HazMat (purple), Service (blue), False Alarm (amber), Other (gray).
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
                    onClick={resetFilters}
                    title="Reset to defaults"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* anchor used by Top Hotspots Select */}
              <div id="hotspot-map-anchor" />

              <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-slate-950/30">
                <HotspotLeafletMap
                  center={deptCenter}
                  focusCenter={focusCenter}
                  pins={pins}
                  clusters={clusters}
                  departmentId={dept.id}
                  mode={mapMode}
                  onHotspotClick={(c) => {
                    setSelectedCluster(c);
                    setFocusCenter(c.center);
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400">{mapNote ?? (mapLoading ? "Geocoding…" : "—")}</div>
                <div className="text-[11px] text-slate-500">
                  {mapMode === "pins"
                    ? "Pins: click a dot to open an incident."
                    : `Hotspots: ${clusters.length} cluster(s) from ${pins.length} pin(s). Click a circle/badge OR use Top Hotspots below.`}
                </div>
              </div>

              {/* Top Hotspots ranked list */}
              {mapMode === "hotspots" ? (
                <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Top hotspots (mapped)</div>
                      <div className="mt-1 text-[11px] text-slate-500">Ranked by incident count. Select to zoom + open drilldown.</div>
                    </div>
                    {selectedCluster ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
                        onClick={() => {
                          setSelectedCluster(null);
                          setFocusCenter(null);
                        }}
                        title="Clear selection"
                      >
                        Clear selection
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {topHotspots.length === 0 ? (
                      <div className="text-xs text-slate-400">No hotspots available yet (need at least 2 mapped pins nearby).</div>
                    ) : (
                      topHotspots.map((c) => {
                        const meta = categoryMeta(c.dominantCategory);
                        const active = selectedCluster?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectHotspot(c)}
                            className={cn(
                              "rounded-md border p-3 text-left",
                              active ? "border-orange-400/60 bg-orange-500/10" : "border-slate-800 bg-slate-950/20 hover:border-slate-700"
                            )}
                            title="Zoom to hotspot + open drilldown"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-100">Hotspot</div>
                              <div
                                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                                style={{ border: `1px solid ${meta.pinColor}`, color: meta.pinColor }}
                              >
                                {c.count}
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">Dominant: {meta.label}</div>
                            <div className="mt-1 text-[11px] text-slate-500">Radius ~{Math.round(c.radiusMeters)}m</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Drilldown panel */}
            {selectedCluster ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Hotspot drilldown</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {selectedCluster.count} incident(s) • Dominant: {categoryMeta(selectedCluster.dominantCategory).label} • Showing up to 24 most recent
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-400"
                    onClick={() => {
                      setSelectedCluster(null);
                      setFocusCenter(null);
                    }}
                    title="Close drilldown"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {drilldownPins.map((p) => {
                    const when = p.occurredAt ? fmtLocalUtc(p.occurredAt).local : "—";
                    const meta = categoryMeta(p.categoryKey);
                    return (
                      <Link
                        key={`${selectedCluster.id}:${p.incidentId}`}
                        href={`/incidents/${p.incidentId}`}
                        className="rounded-md border border-slate-800 bg-slate-950/20 p-3 hover:border-orange-400/60"
                        title="Open incident"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">Incident #{p.incidentId}</div>
                          <div className="text-[11px] font-semibold" style={{ color: meta.pinColor }}>
                            {meta.label}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{p.addressLine}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{when}</div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
