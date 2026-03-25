"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Project = {
  id: number | string;
  name: string;
  status: string;
  category: "fix-n-flip" | "rental" | "contract_work";
  total_budget: number | null;
  start_date: string | null;
};

type ProjectStatus = "planning" | "in-progress" | "on-hold" | "completed";

const statusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: "planning", label: "Planning" },
  { value: "in-progress", label: "In Progress" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

type ProjectsResponse = {
  projects?: Project[];
  message?: string;
};

type CreateProjectResponse = {
  project?: Project;
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [category, setCategory] = useState<Project["category"]>("fix-n-flip");
  const [totalBudget, setTotalBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [closingCosts, setClosingCosts] = useState("0");
  const [loanAmount, setLoanAmount] = useState("0");
  const [clientName, setClientName] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [totalContractValue, setTotalContractValue] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 1 &&
      category.trim().length > 1 &&
      !isSaving
    );
  }, [name, category, isSaving]);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setError("Please login first.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json().catch(() => ({}))) as ProjectsResponse;

        if (!response.ok) {
          if (!cancelled) {
            setError(payload.message ?? "Unable to load projects.");
          }
          return;
        }

        if (!cancelled) {
          setProjects(payload.projects ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load projects right now.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setError("Session expired. Please login again.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          status,
          category,
          total_budget: totalBudget.trim() === "" ? undefined : totalBudget,
          start_date: startDate.trim() === "" ? undefined : startDate,
          purchase_price:
            category === "fix-n-flip" || category === "rental" ? (purchasePrice.trim() === "" ? undefined : purchasePrice) : undefined,
          closing_costs:
            category === "fix-n-flip" || category === "rental" ? (closingCosts.trim() === "" ? undefined : closingCosts) : undefined,
          loan_amount:
            category === "fix-n-flip" || category === "rental" ? (loanAmount.trim() === "" ? undefined : loanAmount) : undefined,
          client_name: category === "contract_work" ? clientName : undefined,
          payment_terms: category === "contract_work" ? paymentTerms : undefined,
          total_contract_value:
            category === "contract_work" ? (totalContractValue.trim() === "" ? undefined : totalContractValue) : undefined,
          amount_paid: category === "contract_work" ? (amountPaid.trim() === "" ? undefined : amountPaid) : undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CreateProjectResponse;

      if (!response.ok) {
        setError(payload.message ?? "Unable to create project.");
        return;
      }

      if (payload.project) {
        setProjects((prev) => [...prev, payload.project as Project]);
      }

      setName("");
      setStatus("planning");
      setCategory("fix-n-flip");
      setTotalBudget("");
      setStartDate("");
      setPurchasePrice("0");
      setClosingCosts("0");
      setLoanAmount("0");
      setClientName("");
      setPaymentTerms("");
      setTotalContractValue("0");
      setAmountPaid("0");
      setShowForm(false);
      setMessage("Project added successfully.");
    } catch {
      setError("Unable to create project right now.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Portfolio</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Projects</h2>
          <p className="mt-2 text-sm text-zinc-600">Track project status and financing details in one place.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setMessage(null);
            setError(null);
          }}
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          {showForm ? "Cancel" : "Add New Project"}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={onCreateProject} className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Project Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="South Austin Rehab"
              required
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as Project["category"])}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
              <option value="fix-n-flip">fix-n-flip</option>
              <option value="rental">rental</option>
              <option value="contract_work">contract_work</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Total Budget</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={totalBudget}
              onChange={(event) => setTotalBudget(event.target.value)}
              placeholder="300000"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </label>

          {category === "fix-n-flip" || category === "rental" ? (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Purchase Price</span>
                <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-zinc-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Closing Costs</span>
                <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-zinc-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={closingCosts}
                    onChange={(event) => setClosingCosts(event.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Loan Amount</span>
                <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-zinc-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={loanAmount}
                    onChange={(event) => setLoanAmount(event.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </span>
              </label>
            </>
          ) : null}

          {category === "contract_work" ? (
            <>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Client Name</span>
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Client name"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Payment Terms</span>
                <input
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  placeholder="Net 30"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Total Contract Value</span>
                <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-zinc-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={totalContractValue}
                    onChange={(event) => setTotalContractValue(event.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Amount Paid</span>
                <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-zinc-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(event) => setAmountPaid(event.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </span>
              </label>
            </>
          ) : null}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isSaving ? "Saving..." : "Save Project"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Current Projects</h3>

        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            No projects yet. Use Add New Project to create your first one.
          </p>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
              >
                <article>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-zinc-900">{project.name}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Status: {project.status}</p>
                    <p className="mt-1 text-sm text-zinc-600">Category: {project.category}</p>
                    <p className="mt-1 text-sm text-zinc-600">Start Date: {project.start_date ?? "Not set"}</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">Open project details</p>
                  </div>

                  <dl className="grid grid-cols-1 gap-2 text-sm text-zinc-700 sm:grid-cols-2 sm:gap-6">
                    <div>
                      <dt className="text-zinc-500">Total Budget</dt>
                      <dd className="font-semibold">
                        {project.total_budget !== null ? formatCurrency(project.total_budget) : "Not set"}
                      </dd>
                    </div>
                  </dl>
                </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
