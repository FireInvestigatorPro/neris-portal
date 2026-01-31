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
  dominantCategory: TypeFilterKey;
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
  | "fire"
  | "ems"
  | "hazmat"
  | "service"
  | "false_alarm"
  | "other";

type GrantMode = "AFG" | "SAFER" | "CRR";

type GrantNarrativeInputs = {
  departmentName: string;
  city: string;
  state: string;
  timeWindowLabel: string;
  mappedIncidentsCount: number;
  hotspotsCount: number;
  categoriesLabel: string;
  topHotspots: Array<{ count: number; dominantLabel: string; radiusMeters: number }>;
};

// -----------------------------
// Utilities
// -----------------------------

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getApiBase() {
  // Prefer the env var you already use in Vercel
  const fromUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromUrl) return fromUrl.replace(/\/+$/, "");

  // Back-compat
  const fromBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (fromBase) return fromBase.replace(/\/+$/, "");

  // Demo-safe fallback
  return "https://infernointelai-backend.onrender.com";
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeAddressParts(parts: Array<string | null | undefined>) {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
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
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function incidentAddressLine(i: ApiIncident) {
  return normalizeAddressParts([i.address, i.city, i.state]);
}

function deptQuery(d: Department) {
  return normalizeAddressParts([d.name, d.city ?? null, d.state ?? null]);
}

function osmSearchUrl(q: string) {
  const u = new URL("https://www.openstreetmap.org/search");
  u.searchParams.set("query", q);
  return u.toString();
}

/**
 * Demo category mapping.
 * In a real build we’ll map exact NERIS incident codes → controlled taxonomy.
 */
function classifyIncident(i: ApiIncident): TypeFilterKey {
  const t = (i.incident_type_code ?? "").toLowerCase();
  if (t.includes("fire")) return "fire";
  if (t.includes("ems") || t.includes("medical")) return "ems";
  if (t.includes("haz")) return "hazmat";
  if (t.includes("service") || t.includes("assist")) return "service";
  if (t.includes("false") || t.includes("alarm")) return "false_alarm";
  return "other";
}

function typeFilterLabel(k: TypeFilterKey) {
  switch (k) {
    case "all":
      return "All categories";
    case "fire":
      return "Fire";
    case "ems":
      return "EMS";
    case "hazmat":
      return "HazMat";
    case "service":
      return "Service";
    case "false_alarm":
      return "False Alarm";
    case "other":
      return "Other";
  }
}

function typeFilterColor(k: TypeFilterKey) {
  switch (k) {
    case "fire":
      return "#ef4444";
    case "ems":
      return "#22c55e";
    case "hazmat":
      return "#a855f7";
    case "service":
      return "#38bdf8";
    case "false_alarm":
      return "#f59e0b";
    case "other":
    case "all":
    default:
      return "#94a3b8";
  }
}

// -----------------------------
// Geocoding (Nominatim / OSM) with localStorage cache
// -----------------------------

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

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Accept-Language": "en" },
    signal,
  });

  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as any;
  const first = Array.isArray(data) ? data[0] : null;

  const lat = first?.lat ? Number(first.lat) : NaN;
  const lon = first?.lon ? Number(first.lon) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const p = { lat, lon };
  writeGeocodeCache(q, p);
  return p;
}

// -----------------------------
// Hotspot clustering
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
  const unused = pins.slice();
  const clusters: HotspotCluster[] = [];

  while (unused.length) {
    const seed = unused.shift()!;
    const group = [seed];

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = unused.length - 1; i >= 0; i--) {
        const p = unused[i];
        const closeToAny = group.some(
          (g) => haversineMeters({ lat: g.lat, lon: g.lon }, { lat: p.lat, lon: p.lon }) <= thresholdMeters
        );
        if (closeToAny) {
          group.push(p);
          unused.splice(i, 1);
          changed = true;
        }
      }
    }

    const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const avgLon = group.reduce((s, p) => s + p.lon, 0) / group.length;
    const center: GeoPoint = { lat: avgLat, lon: avgLon };

    const radius = Math.max(
      120,
      group.reduce((mx, p) => Math.max(mx, haversineMeters(center, { lat: p.lat, lon: p.lon })), 0) + 80
    );

    const counts = new Map<TypeFilterKey, number>();
    for (const p of group) counts.set(p.dominantCategory, (counts.get(p.dominantCategory) ?? 0) + 1);

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

  clusters.sort((a, b) => b.count - a.count);
  return clusters;
}

// -----------------------------
// AI Draft builders
// -----------------------------

function buildAfgNarrative(i: GrantNarrativeInputs) {
  const place = [i.city, i.state].filter(Boolean).join(", ");
  const loc = place ? `${i.departmentName} (${place})` : i.departmentName;

  return [
    `AFG Justification – Draft (Demo “AI Assist”)`,
    ``,
    `Department: ${loc}`,
    `Data window: ${i.timeWindowLabel}`,
    `Observed activity: ${i.mappedIncidentsCount} mapped incident(s); ${i.hotspotsCount} hotspot cluster(s).`,
    `Filter: ${i.categoriesLabel}.`,
    ``,
    `Problem Statement`,
    `Recent incident data shows recurring, geographically concentrated call density (“hotspots”) within the ${i.timeWindowLabel} window. This pattern indicates sustained operational demand and elevated risk exposure for responders and the community.`,
    ``,
    `Project Purpose`,
    `InfernoIntelAI NERIS Hotspot Intelligence converts incident records into operationally useful location intelligence—helping leadership prioritize prevention, readiness, and resource planning. This workflow supports disciplined documentation by separating pattern detection from cause/origin conclusions (NFPA 921-aligned).`,
    ``,
    `Implementation & Outcome Measures`,
    `• Use hotspot clusters to target risk-reduction outreach and inspection programs.`,
    `• Use incident-type and time-window filtering to support evidence-informed resource planning.`,
    `• Track before/after changes in hotspot density and incident frequency to evaluate impact.`,
    ``,
    `Request Summary (fill in)`,
    `• Equipment/Training/Prevention program requested: [Describe here]`,
    `• How request addresses the identified risk patterns: [Describe here]`,
    `• Matching funds/maintenance plan (if applicable): [Describe here]`,
    ``,
    `Compliance / Methodology Note`,
    `This narrative is a planning draft based on incident density patterns and should not be interpreted as a determination of cause, origin, responsibility, or investigative conclusions.`,
  ].join("\n");
}

function buildSaferNarrative(i: GrantNarrativeInputs) {
  const place = [i.city, i.state].filter(Boolean).join(", ");
  const loc = place ? `${i.departmentName} (${place})` : i.departmentName;

  return [
    `SAFER Staffing Justification – Draft (Demo “AI Assist”)`,
    ``,
    `Department: ${loc}`,
    `Data window: ${i.timeWindowLabel}`,
    `Observed activity: ${i.mappedIncidentsCount} mapped incident(s); ${i.hotspotsCount} hotspot cluster(s).`,
    `Filter: ${i.categoriesLabel}.`,
    ``,
    `Operational Need`,
    `Incident patterns show sustained demand with recurring geographic concentrations that can stress staffing, response times, unit availability, and firefighter safety. Improving staffing levels supports safe and effective operations, especially during peak periods and in recurring hotspot areas.`,
    ``,
    `How Hotspot Intelligence Supports SAFER Goals`,
    `• Identifies recurring areas of high incident density to support deployment and scheduling planning.`,
    `• Provides defensible, data-backed context for staffing decisions.`,
    `• Creates a repeatable reporting workflow for annual SAFER progress documentation.`,
    ``,
    `Request Summary (fill in)`,
    `• Staffing request: [# positions / roles / shift model]`,
    `• Impact on response capability & safety: [Describe here]`,
    `• Retention/recruitment plan (if applicable): [Describe here]`,
    ``,
    `Compliance / Methodology Note`,
    `This is a planning draft using incident clustering to describe operational demand. It does not assert cause/origin or investigative conclusions (NFPA 921-aligned discipline).`,
  ].join("\n");
}

function buildCrrBrief(i: GrantNarrativeInputs) {
  const place = [i.city, i.state].filter(Boolean).join(", ");
  const loc = place ? `${i.departmentName} (${place})` : i.departmentName;

  const top = (i.topHotspots ?? []).slice(0, 3);
  const topLines =
    top.length === 0
      ? ["• No hotspot clusters available in the current mapped preview."]
      : top.map(
          (h, idx) =>
            `• Hotspot ${idx + 1}: ${h.count} incident(s) (dominant: ${h.dominantLabel}) • radius ~${Math.round(
              h.radiusMeters
            )}m`
        );

  return [
    `CRR Executive Brief – Draft (Demo “AI Assist”)`,
    ``,
    `Department: ${loc}`,
    `Data window: ${i.timeWindowLabel}`,
    `Filter: ${i.categoriesLabel}`,
    ``,
    `Community Risk Summary`,
    `Current incident mapping shows ${i.mappedIncidentsCount} mappable incident address(es) and ${i.hotspotsCount} hotspot cluster(s) in the selected window. These clusters highlight repeat-demand zones where targeted prevention, inspections coordination, and public education can reduce risk and stabilize workload.`,
    ``,
    `Top Hotspots (Mapped Preview)`,
    ...topLines,
    ``,
    `Recommended CRR Actions (select & tailor)`,
    `• Targeted smoke/CO alarm outreach in hotspot zones`,
    `• Focused inspections / code enforcement coordination for repeat locations`,
    `• Public education aligned to incident mix (cooking, electrical, heating, outdoor burning)`,
    `• Pre-plan updates for high-frequency addresses and critical infrastructure`,
    `• Outcome measures: repeat-location reduction, hotspot intensity trend, response time stability`,
    ``,
    `NFPA-aligned note`,
    `This brief describes density patterns only and does not represent cause/origin conclusions.`,
  ].join("\n");
}

function GrantNarrativePanel(props: GrantNarrativeInputs) {
  const [mode, setMode] = useState<GrantMode>("AFG");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const generated =
      mode === "AFG" ? buildAfgNarrative(props) : mode === "SAFER" ? buildSaferNarrative(props) : buildCrrBrief(props);
    setDraft(generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    props.departmentName,
    props.city,
    props.state,
    props.timeWindowLabel,
    props.mappedIncidentsCount,
    props.hotspotsCount,
    props.categoriesLabel,
    props.topHotspots,
  ]);

  function insertTopHotspots() {
    if (mode !== "CRR") return;

    const top = (props.topHotspots ?? []).slice(0, 3);
    const lines =
      top.length === 0
        ? ["• No hotspot clusters available in the current mapped preview."]
        : top.map(
            (h, idx) =>
              `• Hotspot ${idx + 1}: ${h.count} incident(s) (dominant: ${h.dominantLabel}) • radius ~${Math.round(
                h.radiusMeters
              )}m`
          );

    setDraft((prev) => {
      const marker = "Top Hotspots (Mapped Preview)";
      if (prev.includes(marker)) return prev; // avoid duplicates in demo
      return `${prev}\n\n${marker}\n${lines.join("\n")}`;
    });
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // ignore (demo-safe)
    }
  }

  return (
    <div className="rounded-lg border border-orange-500/25 bg-orange-950/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-orange-300">AI Assist — Grant Narrative Draft</div>
            <span className="rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[10px] text-slate-300">
              Demo mode
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Generates editable AFG/SAFER justification language and a CRR executive brief from live hotspot filters + counts.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-700">
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
              title="CRR executive brief"
            >
              CRR
            </button>
          </div>

          {mode === "CRR" ? (
            <button
              type="button"
              onClick={insertTopHotspots}
              className="rounded-md border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200 hover:bg-slate-950/50"
              title="Insert the Top Hotspots list into the CRR draft"
            >
              Insert Top Hotspots
            </button>
          ) : null}

          <button
            type="button"
            onClick={copyToClipboard}
            className="rounded-md border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200 hover:bg-slate-950/50"
            title="Copy narrative to clipboard"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-slate-800 bg-slate-950/20 p-3 text-[11px] text-slate-300">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Inputs</div>
          <div className="mt-2 space-y-1">
            <div>
              <span className="text-slate-400">Window:</span> {props.timeWindowLabel}
            </div>
            <div>
              <span className="text-slate-400">Category:</span> {props.categoriesLabel}
            </div>
            <div>
              <span className="text-slate-400">Mapped:</span> {props.mappedIncidentsCount} incident(s)
            </div>
            <div>
              <span className="text-slate-400">Hotspots:</span> {props.hotspotsCount} cluster(s)
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-500">
            NFPA note: density patterns ≠ cause/origin conclusions.
          </div>
        </div>

        <div className="md:col-span-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-56 w-full resize-none rounded-md border border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            aria-label="Narrative draft"
          />
          <div className="mt-2 text-[11px] text-slate-500">
            Tip: AFG/SAFER—edit the bracketed lines. CRR—trim to a 1-paragraph executive brief for chiefs/council.
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Leaflet map (loaded via CDN)
// -----------------------------

function HotspotLeafletMap({
  center,
  focusCenter,
  pins,
  clusters,
  mode,
  onHotspotClick,
}: {
  center: GeoPoint | null;
  focusCenter: GeoPoint | null;
  pins: IncidentPin[];
  clusters: HotspotCluster[];
  mode: MapMode;
  onHotspotClick: (c: HotspotCluster) => void;
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

    const map = L.map(mapDivRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(initialCenter, initialZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;
  }, [leafletReady, center]);

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
        const color = typeFilterColor(p.dominantCategory);

        const marker = L.circleMarker([p.lat, p.lon], {
          radius: 7,
          color,
          weight: 2,
          fillColor: color,
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

        marker.addTo(layer);
        bounds.push([p.lat, p.lon]);
      }
    } else {
      for (const c of clusters) {
        const color = typeFilterColor(c.dominantCategory);

        const circle = L.circle([c.center.lat, c.center.lon], {
          radius: c.radiusMeters,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.16,
        });

        const label = L.marker([c.center.lat, c.center.lon], {
          interactive: true,
          icon: L.divIcon({
            className: "",
            html: `<div style="
              width:28px; height:28px; border-radius:999px;
              display:flex; align-items:center; justify-content:center;
              border:2px solid ${color};
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

        circle.bindPopup(`
          <div style="font-size:12px; line-height: 1.25;">
            <div style="font-weight:800; margin-bottom:4px;">Hotspot: ${c.count} incidents</div>
            <div style="opacity:0.85; margin-bottom:4px;">Dominant category: ${typeFilterLabel(c.dominantCategory)}</div>
            <div style="opacity:0.85;">Click to drill down.</div>
          </div>
        `);

        const handle = () => {
          onHotspotClick(c);
          try {
            map.setView([c.center.lat, c.center.lon], Math.max(map.getZoom(), 14), { animate: true });
          } catch {}
        };

        circle.on("click", handle);
        label.on("click", handle);

        circle.addTo(layer);
        label.addTo(layer);

        bounds.push([c.center.lat, c.center.lon]);
      }
    }

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
  }, [leafletReady, pins, clusters, mode, onHotspotClick, focusCenter]);

  if (leafletError) {
    return <div className="p-4 text-xs text-red-200">Map failed to load: {leafletError}</div>;
  }

  if (!leafletReady) {
    return <div className="p-4 text-xs text-slate-300">Loading interactive map…</div>;
  }

  return <div ref={mapDivRef} className="h-80 w-full" aria-label="Interactive hotspot map" />;
}

// -----------------------------
// UI helpers
// -----------------------------

function TimeFilterChips({ value, onChange }: { value: TimeRangeKey; onChange: (v: TimeRangeKey) => void }) {
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

function TypeFilterChips({ value, onChange }: { value: TypeFilterKey; onChange: (v: TypeFilterKey) => void }) {
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

function MapModeToggle({ value, onChange }: { value: MapMode; onChange: (v: MapMode) => void }) {
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
// Page
// -----------------------------

export default function DepartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const deptId = Number(params?.id);

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

  // Load dept + incidents
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
        setError(`Invalid department id: "${params?.id}"`);
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
  }, [apiBase, deptId, isValidId, params?.id]);

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

  // Geocode dept + incidents (demo-safe)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      if (!dept) return;

      setMapLoading(true);
      setMapNote("Geocoding…");

      try {
        // Dept center
        const qDept = deptQuery(dept);
        const deptP = qDept ? await geocodeAddress(qDept, controller.signal) : null;
        if (!cancelled) setDeptCenter(deptP);

        // Incident pins (limit for rate-limits)
        const toGeocode = filteredIncidents.slice(0, 40);

        const builtPins: IncidentPin[] = [];
        for (const inc of toGeocode) {
          if (cancelled) break;

          const q = incidentAddressLine(inc);
          if (!q) continue;

          const p = await geocodeAddress(q, controller.signal);
          if (!p) continue;

          const category = typeFilter === "all" ? classifyIncident(inc) : typeFilter;

          builtPins.push({
            incidentId: inc.id,
            label: `Incident #${inc.id}`,
            addressLine: q,
            occurredAt: inc.occurred_at,
            lat: p.lat,
            lon: p.lon,
            dominantCategory: category,
          });

          await new Promise((r) => setTimeout(r, 120));
        }

        if (!cancelled) {
          setPins(builtPins);

          const filterText = typeFilterLabel(typeFilter);
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
  const topHotspots = useMemo(() => clusters.slice(0, 3), [clusters]);

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
    `${timeRangeLabel(timeRange)} • ` + (typeFilter === "all" ? "All categories" : typeFilterLabel(typeFilter));

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

  function selectHotspot(c: HotspotCluster) {
    setMapMode("hotspots");
    setSelectedCluster(c);
    setFocusCenter(c.center);
    try {
      document.getElementById("hotspot-map-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  }

  const deptQueryForLink = dept ? deptQuery(dept) : "";
  const deptMapLink = deptQueryForLink ? osmSearchUrl(deptQueryForLink) : null;

  const generated = fmtLocalUtc(generatedAt);
  const cityState = dept ? [dept.city, dept.state].filter(Boolean).join(", ") : "";

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
            <h3>NFPA note</h3>
            <div className="print-note">
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

            {/* AI Assist — Grant Narrative Draft */}
            <GrantNarrativePanel
              departmentName={dept.name}
              city={dept.city ?? ""}
              state={dept.state ?? ""}
              timeWindowLabel={timeRangeLabel(timeRange)}
              mappedIncidentsCount={pins.length}
              hotspotsCount={clusters.length}
              categoriesLabel={typeFilterLabel(typeFilter)}
              topHotspots={topHotspots.map((c) => ({
                count: c.count,
                dominantLabel: typeFilterLabel(c.dominantCategory),
                radiusMeters: c.radiusMeters,
              }))}
            />

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

              <div id="hotspot-map-anchor" />

              <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-slate-950/30">
                <HotspotLeafletMap
                  center={deptCenter}
                  focusCenter={focusCenter}
                  pins={pins}
                  clusters={clusters}
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

              {mapMode === "hotspots" ? (
                <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Top hotspots (mapped)</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Ranked by incident count. Select to zoom + open drilldown.
                      </div>
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
                      <div className="text-xs text-slate-400">
                        No hotspots available yet (need at least 2 mapped pins nearby).
                      </div>
                    ) : (
                      topHotspots.map((c) => {
                        const color = typeFilterColor(c.dominantCategory);
                        const active = selectedCluster?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectHotspot(c)}
                            className={cn(
                              "rounded-md border p-3 text-left",
                              active
                                ? "border-orange-400/60 bg-orange-500/10"
                                : "border-slate-800 bg-slate-950/20 hover:border-slate-700"
                            )}
                            title="Zoom to hotspot + open drilldown"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-100">Hotspot</div>
                              <div
                                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                                style={{ border: `1px solid ${color}`, color }}
                              >
                                {c.count}
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              Dominant: {typeFilterLabel(c.dominantCategory)}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">Radius ~{Math.round(c.radiusMeters)}m</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {selectedCluster ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Hotspot drilldown</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {selectedCluster.count} incident(s) • Dominant: {typeFilterLabel(selectedCluster.dominantCategory)} •
                      Showing up to 24 most recent
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
                    const color = typeFilterColor(p.dominantCategory);
                    return (
                      <Link
                        key={`${selectedCluster.id}:${p.incidentId}`}
                        href={`/incidents/${p.incidentId}`}
                        className="rounded-md border border-slate-800 bg-slate-950/20 p-3 hover:border-orange-400/60"
                        title="Open incident"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">Incident #{p.incidentId}</div>
                          <div className="text-[11px] font-semibold" style={{ color }}>
                            {typeFilterLabel(p.dominantCategory)}
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
