"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  message: string;
};

export default function DashboardPage() {
  const [apiStatus, setApiStatus] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
      setError("API base URL is not configured.");
      return;
    }

    fetch(`${baseUrl}/api/v1/health`)
      .then(async (res) => {
        const data = (await res.json()) as HealthResponse;
        setApiStatus(data);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to reach backend API.");
      });
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-orange-400">
        NERIS Portal Dashboard (Demo)
      </h1>
      <p className="text-sm text-slate-200">
        This is a placeholder dashboard. As we build out the NERIS Hotspot
        Intelligence engine, this screen will show active departments, recent
        uploads, grant leads, and risk indicators.
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs">
        <h2 className="font-semibold text-orange-300">Backend API Status</h2>
        <div className="mt-2">
          {apiStatus && (
            <p className="text-green-400">
              {apiStatus.status}: {apiStatus.message}
            </p>
          )}
          {error && <p className="text-red-400">{error}</p>}
          {!apiStatus && !error && (
            <p className="text-slate-300">Checking API health…</p>
          )}
        </div>
      </div>
    </section>
  );
}
