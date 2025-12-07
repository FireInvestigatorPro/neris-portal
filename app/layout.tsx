// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "InfernoIntelAI NERIS Portal",
  description: "NERIS Hotspot Intelligence & Grant Assistant by FireForge LLC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {/* Top nav bar */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-orange-400">
                  FireForge LLC
                </div>
                <div className="text-xs text-slate-300">
                  InfernoIntelAI – NERIS Portal
                </div>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:text-orange-400">
                Home
              </Link>
              <Link href="/login" className="hover:text-orange-400">
                Login
              </Link>
              <Link href="/dashboard" className="hover:text-orange-400">
                Dashboard
              </Link>
              <Link href="/incidents" className="hover:text-orange-400">
                Incidents
              </Link>
                <Link href="/departments" className="hover:text-orange-400">
                Departments</Link>
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

        <footer className="mt-12 border-t border-slate-800 bg-slate-900/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} FireForge Expert Consulting LLC</span>
            <span>NFPA 921-aligned tools for fire investigators</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
