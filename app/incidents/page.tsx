// app/incidents/page.tsx
import Link from "next/link";

const mockIncidents = [
  {
    id: "demo-1",
    title: "Structure fire – multi-family dwelling",
    location: "Demo City, MA",
    date: "2025-01-15",
    status: "Placeholder",
  },
  {
    id: "demo-2",
    title: "Vehicle fire – parking structure",
    location: "Demo City, MA",
    date: "2025-02-03",
    status: "Placeholder",
  },
];

export default function IncidentsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-orange-400">
        NERIS Incidents (Demo)
      </h1>
      <p className="text-xs text-slate-300">
        In the real system, this page will show NERIS-derived incident summaries
        and risk clusters for your jurisdiction. For now, it&apos;s just a
        placeholder list.
      </p>

      <div className="space-y-2">
        {mockIncidents.map((incident) => (
          <Link
            key={incident.id}
            href={`/incidents/${incident.id}`}
            className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100">
                {incident.title}
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                {incident.status}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {incident.location} · {incident.date}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
