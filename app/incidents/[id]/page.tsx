"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Department = {
  id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  neris_department_id?: string | null;
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

type DemoAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string; // ISO
};

type DemoCaseData = {
  notes: string;
  tags: string[];
  attachments: DemoAttachment[];
  updatedAt: string; // ISO
};

function joinLocation(inc: ApiIncident) {
  return [inc.address, inc.city, inc.state].filter(Boolean).join(", ") || "—";
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getApiBase() {
  const fallback = "https://infernointelai-backend.onrender.com";
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? fallback;
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

function caseStorageKey(incidentId: number) {
  return `neris_demo_case_incident_${incidentId}`;
}

function loadCaseData(incidentId: number): DemoCaseData {
  if (typeof window === "undefined") {
    return { notes: "", tags: [], attachments: [], updatedAt: new Date(0).toISOString() };
  }
  try {
    const raw = localStorage.getItem(caseStorageKey(incidentId));
    if (!raw) return { notes: "", tags: [], attachments: [], updatedAt: new Date(0).toISOString() };
    const parsed = JSON.parse(raw) as Partial<DemoCaseData>;
    return {
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string") : [],
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((a) => a && typeof a === "object") as DemoAttachment[]
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return { notes: "", tags: [], attachments: [], updatedAt: new Date(0).toISOString() };
  }
}

function saveCaseData(incidentId: number, data: DemoCaseData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(caseStorageKey(incidentId), JSON.stringify(data));
}

function normalizeTag(input: string) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^#/, "")
    .slice(0, 32);
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const incidentIdStr = params?.id;
  const incidentId = Number(incidentIdStr);

  const departmentIdParam = searchParams?.get("departmentId");
  const departmentId = departmentIdParam ? Number(departmentIdParam) : null;

  const apiBase = getApiBase();

  const [incident, setIncident] = useState<ApiIncident | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Demo “case file” data (localStorage)
  const [caseData, setCaseData] = useState<DemoCaseData>({
    notes: "",
    tags: [],
    attachments: [],
    updatedAt: new Date(0).toISOString(),
  });

  const [tagInput, setTagInput] = useState("");

  const isValidIncidentId = useMemo(
    () => Number.isFinite(incidentId) && incidentId > 0,
    [incidentId]
  );

  const isValidDepartmentId = useMemo(
    () => departmentId !== null && Number.isFinite(departmentId) && departmentId > 0,
    [departmentId]
  );

  // Load local “case file” once incident id is known
  useEffect(() => {
    if (!isValidIncidentId) return;
    const data = loadCaseData(incidentId);
    setCaseData(data);
  }, [incidentId, isValidIncidentId]);

  // Persist local “case file”
  useEffect(() => {
    if (!isValidIncidentId) return;
    saveCaseData(incidentId, caseData);
  }, [caseData, incidentId, isValidIncidentId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatusMsg(null);
      setIncident(null);
      setDepartment(null);

      if (!isValidIncidentId) {
        setError(`Invalid incident id: "${incidentIdStr}"`);
        setLoading(false);
        return;
      }

      // 1) Best path: if we have departmentId, fetch that department’s incidents and find the match.
      if (isValidDepartmentId && departmentId) {
        try {
          setStatusMsg("Loading incident from department…");

          const deptRes = await fetch(`${apiBase}/api/v1/departments/${departmentId}`, {
            cache: "no-store",
          });
          if (deptRes.ok) {
            const d = (await safeJson(deptRes)) as any;
            if (!cancelled && d) {
              setDepartment({
                id: Number(d.id),
                name: String(d.name ?? "Unknown Department"),
                city: d.city ?? null,
                state: d.state ?? null,
                neris_department_id: d.neris_department_id ?? null,
              });
            }
          }

          const incRes = await fetch(
            `${apiBase}/api/v1/departments/${departmentId}/incidents/`,
            { cache: "no-store" }
          );

          if (!incRes.ok) {
            const text = await incRes.text().catch(() => "");
            throw new Error(`Failed to load incidents (${incRes.status}). ${text}`);
          }

          const incJson = await safeJson(incRes);
          const items = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;

          if (!Array.isArray(items)) throw new Error("Unexpected incidents response shape.");

          const match = items.find((x: any) => Number(x?.id) === incidentId) as
            | ApiIncident
            | undefined;

          if (!match) throw new Error("Incident not found in that department.");

          if (!cancelled) {
            setIncident(match);
            setLoading(false);
            setStatusMsg(null);
          }
          return;
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message ?? "Failed to load incident from department.");
            setLoading(false);
            setStatusMsg(null);
          }
          return;
        }
      }

      // 2) Optional fast path: if backend supports GET /api/v1/incidents/{id}
      try {
        setStatusMsg("Loading incident…");

        const res = await fetch(`${apiBase}/api/v1/incidents/${incidentId}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data = (await safeJson(res)) as ApiIncident | null;
          if (!cancelled && data) {
            setIncident(data);

            const deptRes = await fetch(`${apiBase}/api/v1/departments/${data.department_id}`, {
              cache: "no-store",
            });
            if (deptRes.ok) {
              const d = (await safeJson(deptRes)) as any;
              if (!cancelled && d) {
                setDepartment({
                  id: Number(d.id),
                  name: String(d.name ?? "Unknown Department"),
                  city: d.city ?? null,
                  state: d.state ?? null,
                  neris_department_id: d.neris_department_id ?? null,
                });
              }
            }

            setLoading(false);
            setStatusMsg(null);
            return;
          }
        }
      } catch {
        // ignore and try scan fallback
      }

      // 3) Demo-scale fallback: scan departments and search incidents for the ID
      try {
        setStatusMsg("Searching incident across departments…");

        const deptRes = await fetch(`${apiBase}/api/v1/departments/`, { cache: "no-store" });
        if (!deptRes.ok) throw new Error(`Departments fetch failed: ${deptRes.status}`);

        const deptJson = await safeJson(deptRes);
        const deptItems = Array.isArray((deptJson as any)?.items) ? (deptJson as any).items : deptJson;

        if (!Array.isArray(deptItems)) throw new Error("Unexpected departments response shape.");

        const departments: Department[] = deptItems.map((d: any) => ({
          id: Number(d.id),
          name: String(d.name ?? "Unknown Department"),
          city: d.city ?? null,
          state: d.state ?? null,
          neris_department_id: d.neris_department_id ?? null,
        }));

        let foundIncident: ApiIncident | null = null;
        let foundDept: Department | null = null;

        for (const d of departments) {
          if (cancelled) return;

          setStatusMsg(`Checking ${d.name}…`);

          const incRes = await fetch(`${apiBase}/api/v1/departments/${d.id}/incidents/`, {
            cache: "no-store",
          });
          if (!incRes.ok) continue;

          const incJson = await safeJson(incRes);
          const incItems = Array.isArray((incJson as any)?.items) ? (incJson as any).items : incJson;
          if (!Array.isArray(incItems)) continue;

          const match = incItems.find((x: any) => Number(x?.id) === incidentId) as
            | ApiIncident
            | undefined;

          if (match) {
            foundIncident = match;
            foundDept = d;
            break;
          }
        }

        if (!cancelled) {
          if (!foundIncident) {
            setError("Incident not found. It may have been deleted, or not accessible.");
          } else {
            setIncident(foundIncident);
            setDepartment(foundDept);
          }
        }
      } catch (e: any) {
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
  }, [incidentIdStr]);

  function updateCase(partial: Partial<DemoCaseData>) {
    setCaseData((prev) => ({
      ...prev,
      ...partial,
      updatedAt: new Date().toISOString(),
    }));
  }

  function addTag(raw: string) {
    const t = normalizeTag(raw);
    if (!t) return;
    updateCase({
      tags: Array.from(new Set([...(caseData.tags ?? []), t])).slice(0, 12),
    });
    setTagInput("");
  }

  function removeTag(tag: string) {
    updateCase({ tags: (caseData.tags ?? []).filter((t) => t !== tag) });
  }

  function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const next: DemoAttachment[] = [];
    for (const f of Array.from(files)) {
      next.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        addedAt: new Date().toISOString(),
      });
    }

    updateCase({
      attachments: [...(caseData.attachments ?? []), ...next].slice(0, 25),
    });
  }

  function removeAttachment(attId: string) {
    updateCase({
      attachments: (caseData.attachments ?? []).filter((a) => a.id !== attId),
    });
  }

  const caseUpdated = fmtLocalUtc(caseData.updatedAt);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-orange-400">Incident Detail</h1>
          <p className="text-xs text-slate-300">
            Incident ID: <span className="text-slate-100">{incidentIdStr}</span>
            {isValidDepartmentId && departmentId ? (
              <>
                {" "}
                · Dept ID: <span className="text-slate-100">{departmentId}</span>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href="/incidents"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
        >
          ← Back to Incidents
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

      {!loading && incident && (
        <div className="space-y-4">
          {/* Core Incident Summary */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-200">
            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold text-slate-100">
                {incident.neris_incident_id
                  ? `NERIS Incident: ${incident.neris_incident_id}`
                  : `Incident #${incident.id}`}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Occurred</div>
                  <DateBlock iso={incident.occurred_at} />
                </div>

                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Location</div>
                  <div className="text-slate-200">{joinLocation(incident)}</div>
                </div>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Department</div>
                <div className="text-slate-200">
                  {department ? (
                    <>
                      <Link
                        href={`/departments/${department.id}`}
                        className="hover:text-orange-300 underline underline-offset-2"
                      >
                        {department.name}
                      </Link>{" "}
                      <span className="text-slate-400">(ID {department.id})</span>
                    </>
                  ) : (
                    <>ID {incident.department_id}</>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Created</div>
                  <DateBlock iso={incident.created_at} />
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Updated</div>
                  <DateBlock iso={incident.updated_at} />
                </div>
              </div>
            </div>
          </div>

          {/* Case File Panels */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">Case File</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Demo mode: Notes / Tags / Attachments are stored in your browser (localStorage), not the backend yet.
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Last updated</div>
                <div className="text-slate-200">{caseUpdated.local}</div>
                <div className="text-[10px] text-slate-500">{caseUpdated.utc}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {/* Notes */}
              <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Notes</div>
                  <div className="text-[10px] text-slate-500">NFPA 921-aligned narrative</div>
                </div>

                <textarea
                  value={caseData.notes}
                  onChange={(e) => updateCase({ notes: e.target.value })}
                  placeholder="Add investigation notes: scene observations, witness statements, preservation steps, hypotheses, etc."
                  className="mt-2 h-44 w-full resize-none rounded-md border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
                />

                <div className="mt-2 text-[11px] text-slate-400">
                  Tip: keep it “facts first” → “analysis” → “next steps” so it reads clean in court.
                </div>
              </div>

              {/* Tags + Attachments */}
              <div className="space-y-4">
                {/* Tags */}
                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Tags</div>
                    <div className="text-[10px] text-slate-500">{(caseData.tags ?? []).length}/12</div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      placeholder="e.g., electrical, kitchen, injuries"
                      className="w-full rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
                    />
                    <button
                      onClick={() => addTag(tagInput)}
                      className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-orange-400"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(caseData.tags ?? []).length === 0 ? (
                      <div className="text-[11px] text-slate-500">No tags yet.</div>
                    ) : (
                      (caseData.tags ?? []).map((t) => (
                        <button
                          key={t}
                          onClick={() => removeTag(t)}
                          className="rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 hover:border-orange-400"
                          title="Click to remove"
                        >
                          #{t}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">
                    Use tags to filter later: origin-area, utilities, suppression, evidence, etc.
                  </div>
                </div>

                {/* Attachments */}
                <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Attachments</div>
                    <div className="text-[10px] text-slate-500">
                      {(caseData.attachments ?? []).length}/25
                    </div>
                  </div>

                  <div className="mt-2">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        onPickFiles(e.target.files);
                        e.currentTarget.value = "";
                      }}
                      className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border file:border-slate-700 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:text-slate-100 hover:file:border-orange-400"
                    />
                    <div className="mt-2 text-[11px] text-slate-500">
                      Demo stores filename/size/type only (no upload yet).
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(caseData.attachments ?? []).length === 0 ? (
                      <div className="text-[11px] text-slate-500">No attachments yet.</div>
                    ) : (
                      (caseData.attachments ?? []).slice().reverse().map((a) => {
                        const added = fmtLocalUtc(a.addedAt);
                        const kb = Math.max(1, Math.round(a.size / 1024));
                        return (
                          <div
                            key={a.id}
                            className="rounded-md border border-slate-800 bg-slate-950/40 p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs text-slate-100">{a.name}</div>
                                <div className="text-[11px] text-slate-400">
                                  {a.type} · {kb} KB
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Added: {added.local} ({added.utc})
                                </div>
                              </div>
                              <button
                                onClick={() => removeAttachment(a.id)}
                                className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 hover:border-orange-400"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Next step hint */}
            <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Next (Phase 1)</div>
              <div className="mt-1 text-[11px] text-slate-300">
                After this looks good: we wire Notes/Tags/Attachments to real backend tables
                (so departments can collaborate + export).
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
