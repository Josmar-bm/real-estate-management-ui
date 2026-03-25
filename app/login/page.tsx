"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type LoginResponse = {
  user: {
    id: string;
    email: string | null;
  } | null;
  session: {
    access_token: string;
  } | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !isSubmitting;
  }, [email, password, isSubmitting]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as LoginResponse & { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Unable to sign in. Check your credentials and try again.");
        return;
      }

      const token = payload.session?.access_token;
      if (token) {
        window.localStorage.setItem("access_token", token);
      }

      setMessage(
        payload.user?.email
          ? `Welcome back, ${payload.user.email}. Your token is now stored in localStorage.`
          : "Signed in successfully."
      );
      setPassword("");
      router.push("/dashboard");
    } catch {
      setError("Network error while signing in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#fff7ed_0%,#fafaf9_45%,#ecfeff_100%)] px-6 py-10 text-zinc-900">
      <section className="mx-auto flex w-full max-w-6xl items-center justify-center">
        <div className="jbm-fade-up grid w-full overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/85 shadow-[0_20px_70px_-35px_rgba(15,23,42,0.5)] backdrop-blur-sm md:grid-cols-[1.15fr_1fr]">
          <div className="relative hidden bg-zinc-900 p-10 text-zinc-100 md:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.45),transparent_42%),radial-gradient(circle_at_80%_75%,rgba(20,184,166,0.38),transparent_40%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <p className="inline-flex rounded-full border border-zinc-600/70 bg-zinc-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                  JBM Real Estate Management
                </p>
                <h1 className="mt-4 text-3xl font-semibold leading-tight">
                  Welcome back to your property operations hub.
                </h1>
              </div>
              <p className="max-w-xs text-sm text-zinc-300">
                Secure access to listings, tasks, team activity, and pipeline updates.
              </p>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sign In</p>
                <h2 className="mt-2 text-2xl font-semibold">Access your dashboard</h2>
              </div>
              <Link
                href="/"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-900"
              >
                Home
              </Link>
            </div>

            <form className="jbm-fade-up-delay space-y-5" onSubmit={onSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@agency.com"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
