"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Incident = {
  id: number;
  occurred_at: string;
  address: string;
  city: string;
  state: string;
  neris_incident_id?: string;
  department_id: number;
};

function formatLocalAndUtc(iso: string) {
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

/* ---------------- AI DRAFT GENERATOR (LOCAL, DEMO SAFE) ---------------- */

function generateNfpaDraftSummary(input: {
  address: string;
  occurredAt: string;
  icNarrative: string;
  actionsTaken: string[];
  investigationNotes: string;
  tags: string[];
}) {
  const lines: string[] = [];

  lines.push("INCIDENT OVERVIEW");
  lines.push(
    `This incident occurred at ${input.address} on ${input.occurredAt}. The following summary is a structured draft derived from investigator-entered information.`
  );
  lines.push("");

  lines.push("INITIAL OBSERVATIONS (AS REPORTED)");
  lines.push(
    input.icNarrative.trim()
      ? input.icNarrative.trim()
      : "No Incident Commander narrative has been entered at this time."
  );
  lines.push("");

  lines.push("ACTIONS TAKEN");
  if (input.actionsTaken.length > 0) {
    input.actionsTaken.forEach((a) => lines.push(`• ${a}`));
  } else {
    lines.push("No actions taken codes have been recorded.");
  }
  lines.push("");

  lines.push("INVESTIGATION NOTES (DRAFT)");
  lines.push(
    input.investigationNotes.trim()
      ? input.investigationNotes.trim()
      : "No investigative notes have been recorded."
  );
  lines.push("");

  lines.push("OPEN QUESTIONS / INFORMATION GAPS");
  lines.push(
    "• Are all observations documented with source attribution?"
  );
  lines.push(
    "• Have hypotheses been clearly distinguished from verified facts?"
  );
  lines.push(
    "• Are additional examinations, interviews, or tests required?"
  );
  lines.push("");

  lines.push("NFPA 921 COMPLIANCE GUARDRAILS");
  lines.push(
    "This AI-assisted draft is NOT a conclusion. NFPA 921 requires that hypotheses be tested, evidence be preserved, and conclusions be supported by documented facts, observations, and scientific methodology."
  );

  return lines.join("\n");
}

/* ---------------------------------------------------------------------- */

export default function IncidentDetailClient({
  incident,
  departmentId,
}: {
  incident: Incident;
  departmentId: string;
}) {
  const keyBase = useMemo(() => `incident:${incident.id}`, [incident.id]);

  const [icNarrative, setIcNarrative] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  const [aiDraft, setAiDraft] = useState<string | null>(null);

  useEffect(() => {
    try {
      setIcNarrative(localStorage.getItem(`${keyBase}:icNarrative`) ?? "");
      setNotes(localStorage.getItem(`${keyBase}:notes`) ?? "");
      setTags(JSON.parse(localStorage.getItem(`${keyBase}:tags`) ?? "[]"));
      setActionsTaken(
        JSON.parse(localStorage.getItem(`${keyBase}:actions`) ?? "[]")
      );
    } catch {}
  }, [keyBase]);

  useEffect(() => {
    try {
      localStorage.setItem(`${keyBase}:icNarrative`, icNarrative);
      localStorage.setItem(`${keyBase}:notes`, notes);
      localStorage.setItem(`${keyBase}:tags`, JSON.stringify(tags));
      localStorage.setItem(`${keyBase}:actions`, JSON.stringify(actionsTaken));
    } catch {}
  }, [keyBase, icNarrative, notes, tags, actionsTaken]);

  const occurred = formatLocalAndUtc(incident.occurred_at);

  function generateAiDraft() {
    const draft = generateNfpaDraftSummary({
      address: `${incident.address}, ${incident.city}, ${incident.state}`,
      occurredAt: occurred.local,
      icNarrative,
      actionsTaken,
      investigationNotes: notes,
      tags,
    });

    setAiDraft(draft);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-50">
            {incident.address}
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {incident.city}, {incident.state} • Dept{" "}
            <span className="font-mono">{departmentId}</span>
          </div>
          <div className="mt-3 text-sm text-slate-200">
            Occurred: {occurred.local}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link
            className="text-sm text-orange-400 hover:underline"
            href="/incidents"
          >
            ← Back to Incidents
          </Link>
        </div>
      </div>

      {/* IC Narrative */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-semibold text-slate-100">
          Incident Commander Narrative
        </div>
        <textarea
          className="mt-2 w-full h-32 rounded-lg bg-slate-950/40 border border-slate-700 p-3 text-sm"
          value={icNarrative}
          onChange={(e) => setIcNarrative(e.target.value)}
        />
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-semibold text-slate-100">
          Investigation Notes
        </div>
        <textarea
          className="mt-2 w-full h-40 rounded-lg bg-slate-950/40 border border-slate-700 p-3 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      {/* AI Assist */}
      <section className="rounded-xl border border-orange-600/40 bg-orange-950/20 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-orange-300">
            AI Assist — NFPA 921 Draft Summary (Demo)
          </div>
          <button
            className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500"
            onClick={generateAiDraft}
          >
            Generate AI Draft
          </button>
        </div>

        <div className="mt-2 text-xs text-orange-200">
          Assistive draft only. Not a conclusion. Investigator verification
          required.
        </div>

        {aiDraft && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-950/50 border border-slate-700 p-4 text-xs text-slate-200">
            {aiDraft}
          </pre>
        )}
      </section>
    </div>
  );
}
