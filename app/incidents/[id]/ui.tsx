"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Incident = {
  id: number;
  occurred_at: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;

  neris_incident_id?: string | null;

  incident_type_code?: string | number | null;
  incident_type_description?: string | null;
  neris_incident_type_code?: string | number | null;

  department_id: number;
  created_at?: string | null;
  updated_at?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatLocalAndUtc(iso?: string | null) {
  if (!iso) return { local: "Unknown time", utc: "Unknown time" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { local: "Unknown time", utc: "Unknown time" };

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

function buildLocationParts(i: Incident) {
  const parts = [i.address, i.city, i.state].filter(Boolean) as string[];
  return parts;
}

function buildLocation(i: Incident) {
  const parts = buildLocationParts(i);
  return parts.length ? parts.join(", ") : "Unknown location";
}

function getInvestigationMethodology() {
  return "Scientific Method (NFPA 921)";
}

function getDemoStatus() {
  return "Under Investigation";
}

function formatIncidentType(incident: Incident): { code: string | null; desc: string | null } {
  const rawCode = incident.neris_incident_type_code ?? incident.incident_type_code ?? null;
  const code =
    rawCode === null || typeof rawCode === "undefined" ? null : String(rawCode).trim() || null;
  const desc = incident.incident_type_description?.trim() || null;
  return { code, desc };
}

function osmSearchUrl(query: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function osmEmbedUrl(lat: number, lon: number) {
  // Tight bbox around point for a nice zoomed-in embed
  const delta = 0.005; // ~0.5km-ish depending on latitude
  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;

  // marker=lat,lon drops a pin
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
}

type GeoPoint = { lat: number; lon: number };

async function geocodeAddressToPoint(query: string): Promise<GeoPoint | null> {
  // Keep this lightweight: 1 request per incident render.
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

/* -------------------- AI Assist (demo-safe, local-only) -------------------- */

function buildAiDraftSummary(args: {
  title: string;
  location: string;
  occurredLocal: string;
  methodology: string;
  incidentTypeCode: string | null;
  incidentTypeDesc: string | null;
  icNarrative: string;
  actionsTakenCodes: string[];
  notes: string;
  tags: string[];
}) {
  const lines: string[] = [];

  lines.push("NFPA 921 DRAFT SUMMARY (AI ASSIST — DEMO)");
  lines.push(`Case: ${args.title}`);
  lines.push(`Location: ${args.location}`);
  lines.push(`Occurred (local): ${args.occurredLocal}`);
  lines.push(`Methodology: ${args.methodology}`);
  if (args.incidentTypeCode || args.incidentTypeDesc) {
    lines.push(
      `Incident Type: ${args.incidentTypeCode ?? "—"}${args.incidentTypeDesc ? ` (${args.incidentTypeDesc})` : ""}`
    );
  }
  if (args.tags.length) {
    lines.push(`Tags: ${args.tags.join(", ")}`);
  }
  lines.push("");

  lines.push("1) INITIAL OBSERVATIONS (AS REPORTED)");
  lines.push(args.icNarrative.trim() ? args.icNarrative.trim() : "— No IC narrative entered yet.");
  lines.push("");

  lines.push("2) ACTIONS TAKEN (CODES)");
  if (args.actionsTakenCodes.length) {
    args.actionsTakenCodes.forEach((c) => lines.push(`• ${c}`));
  } else {
    lines.push("— No actions taken codes entered.");
  }
  lines.push("");

  lines.push("3) INVESTIGATION NOTES (DRAFT)");
  lines.push(args.notes.trim() ? args.notes.trim() : "— No investigation notes entered yet.");
  lines.push("");

  lines.push("4) INFORMATION GAPS / NEXT QUESTIONS");
  lines.push("• What facts are confirmed vs. reported/unverified?");
  lines.push("• What evidence has been documented with source attribution?");
  lines.push("• What examinations/tests are needed to evaluate hypotheses?");
  lines.push("• Are witness statements and timelines reconciled with physical indicators?");
  lines.push("");

  lines.push("NFPA 921 GUARDRAILS (IMPORTANT)");
  lines.push(
    "This output is an assistive draft only. It does NOT determine origin/cause. NFPA 921 requires hypotheses be tested and conclusions be supported by documented facts, observations, and scientific reasoning."
  );

  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */

export default function IncidentDetailClient({
  incident,
  departmentId,
}: {
  incident: Incident;
  departmentId?: string;
}) {
  const keyBase = useMemo(() => `incident:${incident.id}`, [incident.id]);

  // Existing
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");

  // IC narrative
  const [icNarrative, setIcNarrative] = useState("");

  // Actions Taken (max 3)
  const [actionsTakenCodes, setActionsTakenCodes] = useState<string[]>([]);
  const [actionCodeDraft, setActionCodeDraft] = useState("");

  // ✅ OSM geocode state
  const [geoPoint, setGeoPoint] = useState<GeoPoint | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);

  // ✅ AI assist state
  const [aiDraft, setAiDraft] = useState<string>("");
  const [aiOpen, setAiOpen] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const n = localStorage.getItem(`${keyBase}:notes`) ?? "";
      const t = JSON.parse(localStorage.getItem(`${keyBase}:tags`) ?? "[]");

      const ic = localStorage.getItem(`${keyBase}:icNarrative`) ?? "";
      const at = JSON.parse(localStorage.getItem(`${keyBase}:actionsTakenCodes`) ?? "[]");

      setNotes(n);
      setTags(Array.isArray(t) ? t : []);

      setIcNarrative(ic);
      setActionsTakenCodes(Array.isArray(at) ? at : []);
    } catch {
      // ignore
    }
  }, [keyBase]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(`${keyBase}:notes`, notes);
    } catch {}
  }, [keyBase, notes]);

  useEffect(() => {
    try {
      localStorage.setItem(`${keyBase}:tags`, JSON.stringify(tags));
    } catch {}
  }, [keyBase, tags]);

  useEffect(() => {
    try {
      localStorage.setItem(`${keyBase}:icNarrative`, icNarrative);
    } catch {}
  }, [keyBase, icNarrative]);

  useEffect(() => {
    try {
      localStorage.setItem(`${keyBase}:actionsTakenCodes`, JSON.stringify(actionsTakenCodes));
    } catch {}
  }, [keyBase, actionsTakenCodes]);

  // ✅ Geocode for OSM map
  useEffect(() => {
    const parts = buildLocationParts(incident);
    if (parts.length === 0) return;

    const query = parts.join(", ");

    let cancelled = false;
    (async () => {
      try {
        setGeoLoading(true);
        setGeoFailed(false);

        const pt = await geocodeAddressToPoint(query);
        if (cancelled) return;

        if (!pt) {
          setGeoFailed(true);
          setGeoPoint(null);
        } else {
          setGeoPoint(pt);
        }
      } catch {
        if (!cancelled) {
          setGeoFailed(true);
          setGeoPoint(null);
        }
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [incident.address, incident.city, incident.state]);

  const occurred = formatLocalAndUtc(incident.occurred_at);
  const title = incident.neris_incident_id ? `Incident ${incident.neris_incident_id}` : `Incident #${incident.id}`;
  const location = buildLocation(incident);
  const status = getDemoStatus();
  const methodology = getInvestigationMethodology();
  const { code: incidentTypeCode, desc: incidentTypeDesc } = formatIncidentType(incident);

  const backHref = departmentId ? `/incidents?departmentId=${encodeURIComponent(departmentId)}` : "/incidents";

  const mapsQuery = location === "Unknown location" ? "" : location;
  const osmHref = mapsQuery ? osmSearchUrl(mapsQuery) : null;

  function addTag() {
    const t = tagDraft.trim();
    if (!t) return;
    const exists = tags.some((x) => x.toLowerCase() === t.toLowerCase());
    if (exists) {
      setTagDraft("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagDraft("");
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  function addActionCode() {
    const raw = actionCodeDraft.trim();
    if (!raw) return;

    const normalized = raw.toUpperCase();

    if (actionsTakenCodes.some((c) => c.toUpperCase() === normalized)) {
      setActionCodeDraft("");
      return;
    }
    if (actionsTakenCodes.length >= 3) {
      setActionCodeDraft("");
      return;
    }
    setActionsTakenCodes((prev) => [...prev, normalized]);
    setActionCodeDraft("");
  }

  function removeActionCode(code: string) {
    setActionsTakenCodes((prev) => prev.filter((x) => x !== code));
  }

  function generateAiDraft() {
    try {
      setAiError(null);
      const draft = buildAiDraftSummary({
        title,
        location,
        occurredLocal: occurred.local,
        methodology,
        incidentTypeCode,
        incidentTypeDesc,
        icNarrative,
        actionsTakenCodes,
        notes,
        tags,
      });
      setAiDraft(draft);
    } catch (e: any) {
      setAiError(e?.message ?? "Failed to generate draft.");
    }
  }

  async function copyAiDraft() {
    try {
      setAiError(null);
      if (!aiDraft) return;
      await navigator.clipboard.writeText(aiDraft);
    } catch {
      setAiError("Copy failed (clipboard not available in this browser).");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            Incident Case File <span className="text-slate-600">•</span>{" "}
            <span className="text-slate-300">{title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
            <StatusPill status={status} />
          </div>

          <div className="text-sm text-slate-300">{location}</div>

          <div className="text-sm text-slate-400">
            Dept{" "}
            <span className="font-mono text-slate-200">
              {departmentId ?? String(incident.department_id)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/70"
            href={`/departments/${incident.department_id}`}
          >
            View Department →
          </Link>

          <Link className="text-sm text-orange-400 hover:underline" href={backHref}>
            ← Back to Incidents
          </Link>
        </div>
      </div>

      {/* ✅ AI Assist (demo-safe) */}
      <section className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-orange-300">AI Assist (Demo) — NFPA 921 Draft Summary</h2>
            <p className="mt-1 text-xs text-orange-200/80">
              Local-only draft generator. Assistive documentation only — not a conclusion. Verify all statements and sources.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500"
              onClick={generateAiDraft}
              title="Generate a structured draft summary from your narrative, actions, and notes"
            >
              Generate Draft
            </button>

            <button
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold",
                aiDraft
                  ? "border-orange-500/40 bg-slate-950/30 text-orange-200 hover:bg-slate-950/50"
                  : "border-slate-700 bg-slate-950/20 text-slate-400 cursor-not-allowed"
              )}
              onClick={copyAiDraft}
              disabled={!aiDraft}
              title={aiDraft ? "Copy draft to clipboard" : "Generate a draft first"}
            >
              Copy
            </button>

            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-950/20 px-3 py-2 text-sm text-slate-200 hover:bg-slate-950/40"
              onClick={() => setAiOpen((v) => !v)}
              title={aiOpen ? "Collapse" : "Expand"}
            >
              {aiOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {aiError ? <div className="mt-3 text-xs text-red-200">{aiError}</div> : null}

        {aiOpen ? (
          <div className="mt-4">
            {aiDraft ? (
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-200">
                {aiDraft}
              </pre>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-300">
                Click <span className="font-semibold text-orange-200">Generate Draft</span> to produce a structured,
                NFPA 921-aligned summary from your IC narrative, action codes, notes, and tags.
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Key facts */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Key facts</h2>
          <p className="mt-1 text-xs text-slate-400">
            Fast scan layout for demos; built to expand into NFPA workflows.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FactCard label="Occurred (Local)" value={occurred.local} subValue={`UTC: ${occurred.utc}`} />

          <FactCard
            label="NERIS Incident ID"
            value={incident.neris_incident_id ?? "Not provided"}
            muted={!incident.neris_incident_id}
          />

          <FactCard
            label="Incident Type (code)"
            value={incidentTypeCode ?? "Not provided"}
            subValue={incidentTypeDesc ?? undefined}
            muted={!incidentTypeCode}
          />

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

      {/* ✅ OpenStreetMap */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-orange-400">Location Map</h3>
            <p className="mt-1 text-xs text-slate-400">
              Keyless OpenStreetMap embed + click-through for full map.
            </p>
          </div>

          {osmHref ? (
            <a
              className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/70"
              href={osmHref}
              target="_blank"
              rel="noreferrer"
              title="Open in OpenStreetMap"
            >
              Open map →
            </a>
          ) : (
            <span className="text-xs text-slate-500">No address available</span>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
          {!osmHref ? (
            <div className="p-6 text-sm text-slate-400">No map preview (missing address).</div>
          ) : geoLoading ? (
            <div className="p-6 text-sm text-slate-400">Loading map preview…</div>
          ) : geoFailed || !geoPoint ? (
            <div className="p-6 text-sm text-slate-400">
              Map preview unavailable (couldn’t geocode address). Use “Open map →”.
            </div>
          ) : (
            <iframe
              title="Incident location (OpenStreetMap)"
              className="h-72 w-full"
              loading="lazy"
              src={osmEmbedUrl(geoPoint.lat, geoPoint.lon)}
            />
          )}
        </div>

        <div className="mt-2 text-xs text-slate-500">
          Note: Map preview uses OpenStreetMap geocoding. For production, we can move geocoding server-side + add caching.
        </div>
      </section>

      {/* IC Narrative + Actions Taken */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 md:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Incident Commander Narrative (IC)</div>
              <div className="mt-1 text-xs text-slate-400">
                Document actions and observations. Avoid conclusions unless supported (NFPA 921 discipline).
              </div>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              Auto-saved
            </span>
          </div>

          <textarea
            className="mt-3 h-44 w-full resize-none rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            placeholder="IC narrative: arrival conditions, command decisions, resource assignments, hazards, milestones…"
            value={icNarrative}
            onChange={(e) => setIcNarrative(e.target.value)}
          />
          <div className="mt-2 text-xs text-slate-400">Saved automatically (local to this browser).</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-sm font-semibold text-slate-100">Actions Taken (codes)</div>
          <div className="mt-1 text-xs text-slate-400">
            Up to 3 codes (NERIS). Stored locally for the demo until backend wiring.
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="e.g., 11, 23, 42"
              value={actionCodeDraft}
              onChange={(e) => setActionCodeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addActionCode();
              }}
              disabled={actionsTakenCodes.length >= 3}
            />
            <button
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold text-white",
                actionsTakenCodes.length >= 3
                  ? "bg-slate-700 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-500"
              )}
              onClick={addActionCode}
              type="button"
              disabled={actionsTakenCodes.length >= 3}
              title={actionsTakenCodes.length >= 3 ? "Max 3 codes" : "Add code"}
            >
              Add
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {actionsTakenCodes.length === 0 ? (
              <div className="text-xs text-slate-400">No action codes yet.</div>
            ) : (
              actionsTakenCodes.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-200 hover:border-red-500/40 hover:text-red-200"
                  onClick={() => removeActionCode(c)}
                  title="Click to remove"
                >
                  {c} ✕
                </button>
              ))
            )}
          </div>

          {actionsTakenCodes.length >= 3 ? (
            <div className="mt-2 text-xs text-slate-500">Max 3 codes allowed.</div>
          ) : null}
        </div>
      </div>

      {/* Notes + Tags */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 md:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Investigation Notes</div>
              <div className="mt-1 text-xs text-slate-400">
                Tip: separate <span className="text-slate-200">observations</span>,{" "}
                <span className="text-slate-200">analysis</span>, and{" "}
                <span className="text-slate-200">hypotheses</span> (NFPA 921 style).
              </div>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              Auto-saved
            </span>
          </div>

          <textarea
            className="mt-3 h-44 w-full resize-none rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            placeholder="Observations… Analysis… Hypotheses… Next steps…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="mt-2 text-xs text-slate-400">Saved automatically (local to this browser).</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-sm font-semibold text-slate-100">Tags</div>
          <div className="mt-1 text-xs text-slate-400">
            Use tags for quick filters later (Phase 2): Evidence, Interviews, Utilities, Weather, Documentation…
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="e.g., electrical, repeat address"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTag();
              }}
            />
            <button
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500"
              onClick={addTag}
              type="button"
            >
              Add
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <div className="text-xs text-slate-400">No tags yet.</div>
            ) : (
              tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-200 hover:border-red-500/40 hover:text-red-200"
                  onClick={() => removeTag(t)}
                  title="Click to remove"
                >
                  {t} ✕
                </button>
              ))
            )}
          </div>
        </div>
      </div>
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
      <div className={cn("mt-1 text-sm font-semibold", muted ? "text-slate-400" : "text-slate-100")}>
        {value}
      </div>
      {subValue ? <div className="mt-1 text-xs text-slate-500">{subValue}</div> : null}
    </div>
  );
}
