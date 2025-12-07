// app/departments/page.tsx
import Link from "next/link";

type Department = {
  id: string;
  name: string;
  city: string;
  state: string;
  nerisStatus: string;
  incidentsTracked: number;
};

const mockDepartments: Department[] = [
  {
    id: "demo-frfd",
    name: "Demo Fire Rescue Department",
    city: "Demo City",
    state: "MA",
    nerisStatus: "Pilot",
    incidentsTracked: 42,
  },
  {
    id: "demo-rural",
    name: "Demo Rural Fire District",
    city: "Demo County",
    state: "VT",
    nerisStatus: "Onboarding",
    incidentsTracked: 12,
  },
];

export default function DepartmentsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-orange-400">
        Departments (Demo)
      </h1>
      <p className="text-xs text-slate-300">
        In the production NERIS Hotspot Intelligence platform, this page will
        show the departments your FireForge account manages, along with NERIS
        onboarding status and activity.
      </p>

      <div className="space-y-2">
        {mockDepartments.map((dept) => (
          <Link
            key={dept.id}
            href={`/departments/${dept.id}`}
            className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs hover:border-orange-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-100">
                  {dept.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {dept.city}, {dept.state}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-300">
                <div>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px]">
                    {dept.nerisStatus}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {dept.incidentsTracked} incidents tracked
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
