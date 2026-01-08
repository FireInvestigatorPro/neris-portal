import Link from "next/link";

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const incidentId = params.id;

  // Demo-safe placeholder (your real fetch already exists)
  const incident = {
    id: incidentId,
    title: "Structure Fire – Single Family",
    location: "123 Main St, Fall River, MA",
    occurredAt: "2025-01-08T02:14:00Z",
    status: "Under Investigation",
    department: {
      id: "5",
      name: "Fall River Fire Department",
    },
  };

  const localTime = new Date(incident.occurredAt).toLocaleString();
  const utcTime = new Date(incident.occurredAt).toUTCString();

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <section className="space-y-2">
        <div className="text-xs text-slate-400">Incident Case File</div>
        <h1 className="text-2xl font-semibold">{incident.title}</h1>
        <div className="text-sm text-slate-300">{incident.location}</div>
      </section>

      {/* STATUS STRIP */}
      <section className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <StatusPill status={incident.status} />
        <div className="text-sm">
          <span className="text-slate-400">Occurred:</span>{" "}
          {localTime}
          <div className="text-xs text-slate-500">UTC: {utcTime}</div>
        </div>
        <Link
          href={`/departments/${incident.department.id}`}
          className="text-sm text-orange-400 hover:underline"
        >
          {incident.department.name}
        </Link>
      </section>

      {/* NOTES */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">
          Investigation Notes
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          Notes entered here are structured to support NFPA 921 methodology,
          separating observations, analysis, and hypotheses.
        </p>
        {/* Your existing Notes UI stays here */}
      </section>

      {/* TAGS */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">Tags</h3>
        {/* Your existing Tags UI stays here */}
      </section>

      {/* ATTACHMENTS */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-sm font-semibold text-orange-400">
          Evidence & Attachments
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Photos, reports, and supporting documentation (Phase 2)
        </p>
      </section>

      {/* EXPORT */}
      <section className="flex justify-end">
        <button
          disabled
          className="rounded bg-slate-700 px-4 py-2 text-sm text-slate-300 cursor-not-allowed"
        >
          Export Case File (PDF)
        </button>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "Completed"
      ? "bg-green-600"
      : status === "Under Investigation"
      ? "bg-yellow-500"
      : "bg-slate-600";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold text-black ${color}`}
    >
      {status}
    </span>
  );
}
