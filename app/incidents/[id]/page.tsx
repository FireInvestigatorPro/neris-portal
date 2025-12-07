// app/incidents/[id]/page.tsx
import Link from "next/link";

export default async function IncidentDetailPage(props: any) {
  const resolvedParams = await props.params;
  const id = resolvedParams?.id ?? "unknown";

  return (
    <section className="space-y-4">
      <Link
        href="/incidents"
        className="text-xs text-slate-400 hover:text-orange-300"
      >
        ← Back to incidents
      </Link>

      <h1 className="text-2xl font-semibold text-orange-400">
        Incident: {id}
      </h1>

      <p className="text-xs text-slate-300">
        This is a placeholder incident detail screen. Eventually this will show
        NERIS incident details, geo-risk context, and grant tie-ins for this
        specific incident.
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-200">
        <p>
          <span className="font-semibold">Status:</span> Demo only
        </p>
        <p className="mt-1">
          <span className="font-semibold">Next steps:</span> Wire this view to a
          real <code>/incidents/&lt;id&gt;</code> API endpoint backed by your
          Postgres DB.
        </p>
      </div>
    </section>
  );
}
