// app/login/LoginClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") ?? "/dashboard", [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Show server message (yours is {"detail":"Invalid credentials."})
        setMsg(text || `Login failed (${res.status}).`);
        setBusy(false);
        return;
      }

      // Full reload so cookie is definitely present for server routes
      window.location.assign(nextPath);
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to fetch.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm text-slate-200">
        Email
        <input
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-orange-500"
          placeholder="you@department.gov"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      <label className="block text-sm text-slate-200">
        Password (demo)
        <input
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-orange-500"
          placeholder="demo password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      {msg ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-2 text-sm text-red-200">
          {msg}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
