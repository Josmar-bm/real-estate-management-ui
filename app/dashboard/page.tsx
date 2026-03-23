export default function DashboardHomePage() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Dashboard</p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Home</h1>
      <p className="max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
        Welcome to your operations command center. This area can surface listing summaries, pipeline activity,
        and team actions.
      </p>
    </div>
  );
}
