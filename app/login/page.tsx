"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const n = searchParams.get("next");
    return n && n.startsWith("/") ? n : "/departments";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail ?? `Login failed (${res.status})`);
        setBusy(false);
        return;
      }

      // Cookie is now set by the server; middleware will allow protected routes.
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Login failed.");
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <h1 className="text-xl font-semibold text-orange-400">Investigator Login</h1>
      <p className="text-xs text-slate-300">
        Demo access gate for the NERIS portal. This prevents random visitors from reaching
        the data-entry screens.
      </p>

      {error ? (
        <div className="rounded-md border border-red-800 bg-red-950/40 p-3 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-orange-400"
            placeholder="you@firedepartment.gov"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-orange-400"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
        >
          {busy ? "Logging in…" : "Log In"}
        </button>
      </form>

      <p className="text-[11px] text-slate-400">
        Demo environment only. For access, contact{" "}
        <a
          href="mailto:kperry@fireforgeconsulting.com"
          className="text-orange-300 underline"
        >
          kperry@fireforgeconsulting.com
        </a>
        .
      </p>

      <p className="text-[11px] text-slate-500">
        <Link href="/" className="hover:text-orange-300">
          ← Back to landing page
        </Link>
      </p>
    </section>
  );
}
