import Link from "next/link";

export function LandingPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(140deg,#f5f1e8_0%,#f9f8f4_40%,#eaf4f1_100%)] px-6 py-10">
      <div className="pointer-events-none absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-[-5rem] h-80 w-80 rounded-full bg-amber-200/50 blur-3xl" />

      <section className="jbm-fade-up relative w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-300/70 bg-white/80 p-8 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:p-10">
        <div className="mb-8 space-y-4 text-center">
          <p className="mx-auto inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">
            JBM Real Estate Management
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Manage properties with speed and clarity.
          </h1>
          <p className="mx-auto max-w-md text-sm leading-6 text-zinc-600 sm:text-base">
            Secure access to listings, agents, and operational workflows from one command center.
          </p>
        </div>

        <div className="jbm-fade-up-delay flex flex-col gap-4 text-base font-semibold sm:flex-row">
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-5 text-white transition hover:-translate-y-0.5 hover:bg-zinc-700"
            href="/login"
          >
            Login
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-zinc-900 transition hover:-translate-y-0.5 hover:border-zinc-900"
            href="/register"
          >
            Sign Up
          </Link>
        </div>
      </section>
    </main>
  );
}
