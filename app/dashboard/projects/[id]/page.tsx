"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  status: string;
  category: "fix-n-flip" | "rental" | "contract_work";
  total_budget: number | null;
  start_date: string | null;
};

type MaterialExpense = {
  id: string;
  project_id: string | null;
  vendor_id: string | null;
  item_name: string;
  cost: number;
  receipt_path: string | null;
  purchase_date: string | null;
};

type LaborLog = {
  id: string;
  project_id: string | null;
  person_id: string | null;
  work_date: string | null;
  hours_worked: number | null;
  pay_rate_applied: number | null;
  total_labor_cost: number | null;
};

type ProjectDetailsResponse = {
  project?: Project;
  materialExpenses?: MaterialExpense[];
  laborLogs?: LaborLog[];
  summary?: {
    materialExpenseCount: number;
    materialExpenseTotal: number;
    laborLogCount: number;
    laborCostTotal: number;
  };
  message?: string;
};

type CreateMaterialExpenseResponse = {
  materialExpense?: MaterialExpense;
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [materialExpenses, setMaterialExpenses] = useState<MaterialExpense[]>([]);
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);
  const [materialExpenseTotal, setMaterialExpenseTotal] = useState(0);
  const [laborCostTotal, setLaborCostTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "material-expenses" | "labor-log">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  const [itemName, setItemName] = useState("");
  const [cost, setCost] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [receiptPath, setReceiptPath] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setError("Project details are unavailable.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProjectDetails() {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json().catch(() => ({}))) as ProjectDetailsResponse;

        if (!response.ok) {
          if (!cancelled) {
            setError(payload.message ?? "Unable to load project details.");
          }
          return;
        }

        if (!cancelled) {
          setProject(payload.project ?? null);
          setMaterialExpenses(payload.materialExpenses ?? []);
          setMaterialExpenseTotal(payload.summary?.materialExpenseTotal ?? 0);
          setLaborLogs(payload.laborLogs ?? []);
          setLaborCostTotal(payload.summary?.laborCostTotal ?? 0);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load project details right now.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProjectDetails();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const materialExpenseCount = useMemo(() => materialExpenses.length, [materialExpenses]);
  const laborLogCount = useMemo(() => laborLogs.length, [laborLogs]);

  async function onCreateMaterialExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);

    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setFormError("You need to be logged in to add material expenses.");
      return;
    }

    setIsSavingExpense(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/material-expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_name: itemName,
          cost,
          vendor_id: vendorId.trim() === "" ? undefined : vendorId,
          receipt_path: receiptPath.trim() === "" ? undefined : receiptPath,
          purchase_date: purchaseDate.trim() === "" ? undefined : purchaseDate,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CreateMaterialExpenseResponse;

      if (!response.ok) {
        setFormError(payload.message ?? "Unable to create material expense.");
        return;
      }

      if (payload.materialExpense) {
        setMaterialExpenses((prev) => [payload.materialExpense as MaterialExpense, ...prev]);
        setMaterialExpenseTotal((prev) => prev + Number(payload.materialExpense?.cost ?? 0));
      }

      setItemName("");
      setCost("");
      setVendorId("");
      setReceiptPath("");
      setPurchaseDate("");
      setFormMessage("Material expense added successfully.");
    } catch {
      setFormError("Unable to create material expense right now.");
    } finally {
      setIsSavingExpense(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-600">Loading project details...</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/projects" className="text-sm font-medium text-zinc-700 underline underline-offset-4">
          Back to Projects
        </Link>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/projects" className="text-sm font-medium text-zinc-700 underline underline-offset-4">
          Back to Projects
        </Link>
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/projects" className="text-sm font-medium text-zinc-700 underline underline-offset-4">
            Back to Projects
          </Link>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{project.name}</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Category: {project.category} · Status: {project.status}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-3 border-b border-zinc-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "overview"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900 hover:text-zinc-900"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("material-expenses")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "material-expenses"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900 hover:text-zinc-900"
            }`}
          >
            Material Expenses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("labor-log")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "labor-log"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900 hover:text-zinc-900"
            }`}
          >
            Labor Log
          </button>
        </div>

        {activeTab === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Project Overview</p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-zinc-500">Start Date</dt>
                  <dd className="mt-1 text-base font-semibold text-zinc-900">{formatDate(project.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-zinc-500">Total Budget</dt>
                  <dd className="mt-1 text-base font-semibold text-zinc-900">
                    {project.total_budget !== null ? formatCurrency(project.total_budget) : "Not set"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Material Expenses</p>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm text-zinc-500">Expense Count</p>
                  <p className="text-2xl font-semibold text-zinc-900">{materialExpenseCount}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Total Material Spend</p>
                  <p className="text-2xl font-semibold text-zinc-900">{formatCurrency(materialExpenseTotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Labor Cost</p>
                  <p className="text-2xl font-semibold text-zinc-900">{formatCurrency(laborCostTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "material-expenses" ? (
          <section className="space-y-4">
            <form onSubmit={onCreateMaterialExpense} className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <label className="block xl:col-span-3">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Item Name</span>
                <input
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="Drywall sheets"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Cost</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  placeholder="1250.00"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Vendor ID</span>
                <input
                  value={vendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                  placeholder="Optional vendor uuid"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Purchase Date</span>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block xl:col-span-3">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Receipt Path</span>
                <input
                  value={receiptPath}
                  onChange={(event) => setReceiptPath(event.target.value)}
                  placeholder="Optional storage path"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <div className="xl:col-span-3 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="w-fit rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isSavingExpense ? "Saving..." : "Add Material Expense"}
                </button>
                {formError ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
                ) : null}
                {formMessage ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{formMessage}</p>
                ) : null}
              </div>
            </form>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-sm text-zinc-500">Expense Count</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{materialExpenseCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:col-span-2 xl:col-span-1">
                <p className="text-sm text-zinc-500">Total Material Spend</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrency(materialExpenseTotal)}</p>
              </div>
            </div>

            {materialExpenses.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                No material expenses recorded for this project yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Purchase Date</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {materialExpenses.map((expense) => (
                        <tr key={expense.id} className="align-top">
                          <td className="px-4 py-3 font-medium text-zinc-900">{expense.item_name}</td>
                          <td className="px-4 py-3 text-zinc-600">{formatDate(expense.purchase_date)}</td>
                          <td className="px-4 py-3 text-zinc-600">{expense.vendor_id ?? "Not linked"}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">{formatCurrency(expense.cost)}</td>
                          <td className="px-4 py-3 text-zinc-600">{expense.receipt_path ?? "Not uploaded"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "labor-log" ? (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-sm text-zinc-500">Entries</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{laborLogCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:col-span-2 xl:col-span-1">
                <p className="text-sm text-zinc-500">Total Labor Cost</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrency(laborCostTotal)}</p>
              </div>
            </div>

            {laborLogs.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                No labor log entries recorded for this project yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Work Date</th>
                        <th className="px-4 py-3">Person</th>
                        <th className="px-4 py-3">Hours</th>
                        <th className="px-4 py-3">Rate</th>
                        <th className="px-4 py-3">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {laborLogs.map((entry) => (
                        <tr key={entry.id} className="align-top">
                          <td className="px-4 py-3 text-zinc-600">{formatDate(entry.work_date)}</td>
                          <td className="px-4 py-3 text-zinc-600">{entry.person_id ?? "Not linked"}</td>
                          <td className="px-4 py-3 text-zinc-600">{entry.hours_worked ?? 0}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {entry.pay_rate_applied !== null ? formatCurrency(entry.pay_rate_applied) : "Not set"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {entry.total_labor_cost !== null ? formatCurrency(entry.total_labor_cost) : formatCurrency(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </section>
    </div>
  );
}
