"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type DashboardShellProps = {
  children: ReactNode;
};

type Profile = {
  displayName: string;
  email: string;
};

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/estimates", label: "Estimates" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  const accessToken =
    typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
  const hasToken = Boolean(accessToken);

  const activePageTitle = navItems.find((item) => item.href === pathname)?.label ?? "Dashboard";
  const displayName = profile?.displayName ?? "Agent";
  const email = profile?.email ?? "No email";

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isCancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          user?: { displayName?: string | null; email?: string | null };
        };

        if (!isCancelled) {
          setProfile({
            displayName: payload.user?.displayName ?? "Agent",
            email: payload.user?.email ?? "No email",
          });
        }
      } catch {
        if (!isCancelled) {
          setProfile(null);
        }
      }
    }

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, pathname]);

  function signOut() {
    window.localStorage.removeItem("access_token");
    router.replace("/login");
  }

  if (!hasToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(145deg,#f5f1e8_0%,#f9f8f4_45%,#eaf4f1_100%)] px-6 text-zinc-700">
        <p className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium shadow-sm">
          Loading your dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#f7f3ea_0%,#f9fafb_48%,#ecfdf5_100%)] p-4 text-zinc-900 sm:p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-[250px_1fr]">
        <aside className="jbm-fade-up rounded-3xl border border-zinc-300/70 bg-white/90 p-5 shadow-[0_15px_45px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm">
          <p className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
            JBM Real Estate Management
          </p>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-zinc-900 text-white shadow"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="mt-8 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-900"
          >
            Sign Out
          </button>
        </aside>

        <section className="jbm-fade-up-delay rounded-3xl border border-zinc-300/70 bg-white/90 p-6 shadow-[0_15px_45px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm sm:p-8">
          <header className="mb-8 flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{activePageTitle}</h1>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <p className="font-semibold text-zinc-900">{displayName}</p>
              <p className="text-zinc-600">{email}</p>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
