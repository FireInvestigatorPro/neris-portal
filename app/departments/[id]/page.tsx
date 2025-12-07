// app/departments/[id]/page.tsx
import Link from "next/link";

export default async function DepartmentDetailPage(props: any) {
  const params = await props.params;
  const id = params?.id ?? "unknown";

  // In the future, we'll fetch real department info here via the backend.
  // For now, we just echo the ID.
  return (
    <section className="space-y-4">
      <Link
        href="/departments"
        className="text-xs text-slate-400 hover:text-orange-300"
      >
        ← Back to departments
      </Link>

      <h1 className="text-2xl font-semibold text-orange-400">
        Department: {id}
      </h1>

      <p className="text-xs text-slate-300">
        This is a placeholder department detail screen. Eventually this will
        show NERIS configuration, census/parcel overlays, training / grant
        status, and incident hotspots for this specific department.
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-200 space-y-2">
        <p>
          <span className="font-semibold">NERIS Status:</span> Demo only
        </p>
        <p>
          <span className="font-semibold">Next steps:</span> Wire this view to a
          real <code>/departments/&lt;id&gt;</code> API endpoint that returns
          department metadata and basic metrics.
        </p>
      </div>
    </section>
  );
}
