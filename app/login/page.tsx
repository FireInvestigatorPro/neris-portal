// app/login/page.tsx
"use client";
import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <h1 className="text-xl font-semibold text-orange-400">
        Investigator Login
      </h1>
      <p className="text-xs text-slate-300">
        This is a placeholder login screen. In a later step we&apos;ll connect
        this to the real authentication API.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          alert("Login wiring will be added once auth API is ready.");
        }}
      >
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-orange-400"
            placeholder="you@firedepartment.gov"
          />
        </div>
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-orange-400"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400"
        >
          Log In
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