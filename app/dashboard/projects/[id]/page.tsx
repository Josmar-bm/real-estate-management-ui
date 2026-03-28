"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

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
  name: string;
  description: string | null;
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

type TimesheetRow = {
  personId: string;
  personName: string;
  payRate: string;
  hoursByDate: Record<string, string>;
  entryIdsByDate: Record<string, string | undefined>;
};

type Personnel = {
  id: string;
  name: string;
  worker_type: string | null;
  default_rate: number | null;
};

type Vendor = {
  id: string;
  name: string;
};

type ProjectDetailsResponse = {
  project?: Project;
  materialExpenses?: MaterialExpense[];
  laborLogs?: LaborLog[];
  projectInvestment?: {
    project_id: string;
    purchase_price: number | null;
    closing_costs: number | null;
    loan_amount: number | null;
  } | null;
  projectContract?: {
    project_id: string;
    client_name: string | null;
    payment_terms: string | null;
    total_contract_value: number | null;
    amount_paid: number | null;
  } | null;
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

type PersonnelResponse = {
  personnel?: Personnel[];
  message?: string;
};

type VendorsResponse = {
  vendors?: Vendor[];
  message?: string;
};

const projectStatusOptions = ["planning", "in-progress", "on-hold", "completed"] as const;

const columnHelper = createColumnHelper<TimesheetRow>();

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

function formatMonthDay(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatMonthDayWithWeekday(value: string | null) {
  if (!value) {
    return { monthDay: "Not set", weekday: "" };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { monthDay: value, weekday: "" };
  }

  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(date);

  return { monthDay, weekday };
}

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [materialExpenses, setMaterialExpenses] = useState<MaterialExpense[]>([]);
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);
  const [materialExpenseTotal, setMaterialExpenseTotal] = useState(0);
  const [laborCostTotal, setLaborCostTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "project-details" | "material-expenses" | "labor-log">("overview");
  const [weekStart, setWeekStart] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    return monday.toISOString().slice(0, 10);
  });
  const [timesheetRows, setTimesheetRows] = useState<TimesheetRow[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [laborLogPersonFilter, setLaborLogPersonFilter] = useState("all");
  const [laborLogStartDate, setLaborLogStartDate] = useState("");
  const [laborLogEndDate, setLaborLogEndDate] = useState("");
  const [materialPageSize, setMaterialPageSize] = useState(10);
  const [materialPage, setMaterialPage] = useState(1);
  const [laborPageSize, setLaborPageSize] = useState(10);
  const [laborPage, setLaborPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTimesheet, setIsSavingTimesheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<string>("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [closingCosts, setClosingCosts] = useState("0");
  const [loanAmount, setLoanAmount] = useState("0");
  const [clientName, setClientName] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [totalContractValue, setTotalContractValue] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [isSavingCategoryDetails, setIsSavingCategoryDetails] = useState(false);
  const [categoryDetailsError, setCategoryDetailsError] = useState<string | null>(null);
  const [categoryDetailsMessage, setCategoryDetailsMessage] = useState<string | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [receiptActionId, setReceiptActionId] = useState<string | null>(null);
  const [receiptActionError, setReceiptActionError] = useState<string | null>(null);
  const [uploadingInlineReceiptId, setUploadingInlineReceiptId] = useState<string | null>(null);

  const [expenseName, setExpenseName] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [cost, setCost] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [receiptPath, setReceiptPath] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [purchaseDate, setPurchaseDate] = useState("");

  const weekDates = useMemo(() => {
    const base = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(base.getTime())) {
      return [] as string[];
    }

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      return day.toISOString().slice(0, 10);
    });
  }, [weekStart]);

  const personnelById = useMemo(() => {
    const map = new Map<string, Personnel>();
    for (const person of personnel) {
      map.set(person.id, person);
    }
    return map;
  }, [personnel]);

  const vendorsById = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const vendor of vendors) {
      map.set(vendor.id, vendor);
    }
    return map;
  }, [vendors]);

  const loadProjectDetails = useCallback(async () => {
    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setError("Project details are unavailable.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as ProjectDetailsResponse;

      if (!response.ok) {
        setError(payload.message ?? "Unable to load project details.");
        return;
      }

      setProject(payload.project ?? null);
      setStatusDraft(payload.project?.status ?? "");
      setPurchasePrice(String(payload.projectInvestment?.purchase_price ?? 0));
      setClosingCosts(String(payload.projectInvestment?.closing_costs ?? 0));
      setLoanAmount(String(payload.projectInvestment?.loan_amount ?? 0));
      setClientName(payload.projectContract?.client_name ?? "");
      setPaymentTerms(payload.projectContract?.payment_terms ?? "");
      setTotalContractValue(String(payload.projectContract?.total_contract_value ?? 0));
      setAmountPaid(String(payload.projectContract?.amount_paid ?? 0));
      setMaterialExpenses(payload.materialExpenses ?? []);
      setMaterialExpenseTotal(payload.summary?.materialExpenseTotal ?? 0);
      setLaborLogs(payload.laborLogs ?? []);
      setLaborCostTotal(payload.summary?.laborCostTotal ?? 0);
      setError(null);

      const [personnelResponse, vendorsResponse] = await Promise.all([
        fetch("/api/personnel", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/vendors", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const personnelPayload = (await personnelResponse.json().catch(() => ({}))) as PersonnelResponse;
      if (personnelResponse.ok) {
        setPersonnel(personnelPayload.personnel ?? []);
      }

      const vendorsPayload = (await vendorsResponse.json().catch(() => ({}))) as VendorsResponse;
      if (vendorsResponse.ok) {
        setVendors(vendorsPayload.vendors ?? []);
      }
    } catch {
      setError("Unable to load project details right now.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setIsLoading(true);
    loadProjectDetails();
  }, [loadProjectDetails]);

  useEffect(() => {
    if (weekDates.length === 0) {
      setTimesheetRows([]);
      return;
    }

    const map = new Map<string, TimesheetRow>();

    for (const log of laborLogs) {
      const personId = log.person_id ?? "unassigned";
      const workDate = log.work_date ? log.work_date.slice(0, 10) : "";

      if (!map.has(personId)) {
        const matchedPerson = personnelById.get(personId);
        map.set(personId, {
          personId,
          personName: matchedPerson?.name ?? personId,
          payRate: String(log.pay_rate_applied ?? 0),
          hoursByDate: {},
          entryIdsByDate: {},
        });
      }

      const row = map.get(personId);
      if (!row) {
        continue;
      }

      const hoursWorked = Number(log.hours_worked ?? 0);
      if (workDate && weekDates.includes(workDate) && Number.isFinite(hoursWorked) && hoursWorked > 0) {
        row.hoursByDate[workDate] = String(hoursWorked);
        row.entryIdsByDate[workDate] = log.id;
      }

      if ((row.payRate === "0" || row.payRate === "0.00") && log.pay_rate_applied !== null) {
        row.payRate = String(log.pay_rate_applied);
      }
    }

    setTimesheetRows(Array.from(map.values()));
  }, [laborLogs, weekDates, personnelById]);

  const materialExpenseCount = useMemo(() => materialExpenses.length, [materialExpenses]);
  const laborLogCount = useMemo(() => laborLogs.length, [laborLogs]);
  const totalSpent = useMemo(() => materialExpenseTotal + laborCostTotal, [materialExpenseTotal, laborCostTotal]);

  const laborLogPersonOptions = useMemo(() => {
    const ids = new Set<string>();

    for (const entry of laborLogs) {
      if (entry.person_id) {
        ids.add(entry.person_id);
      }
    }

    return Array.from(ids)
      .map((id) => ({
        id,
        label: personnelById.get(id)?.name ?? id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [laborLogs, personnelById]);

  const filteredLaborLogs = useMemo(() => {
    return laborLogs.filter((entry) => {
      if (laborLogPersonFilter === "unassigned" && entry.person_id) {
        return false;
      }

      if (laborLogPersonFilter !== "all" && laborLogPersonFilter !== "unassigned" && entry.person_id !== laborLogPersonFilter) {
        return false;
      }

      const workDateKey = entry.work_date ? entry.work_date.slice(0, 10) : "";
      if (laborLogStartDate || laborLogEndDate) {
        if (!workDateKey) {
          return false;
        }

        if (laborLogStartDate && workDateKey < laborLogStartDate) {
          return false;
        }

        if (laborLogEndDate && workDateKey > laborLogEndDate) {
          return false;
        }
      }

      return true;
    });
  }, [laborLogs, laborLogPersonFilter, laborLogStartDate, laborLogEndDate]);

  const filteredLaborSummary = useMemo(() => {
    let totalHours = 0;
    let totalPay = 0;

    for (const entry of filteredLaborLogs) {
      const hours = Number(entry.hours_worked ?? 0);
      if (Number.isFinite(hours)) {
        totalHours += hours;
      }

      if (entry.total_labor_cost !== null && Number.isFinite(entry.total_labor_cost)) {
        totalPay += entry.total_labor_cost;
        continue;
      }

      const rate = Number(entry.pay_rate_applied ?? 0);
      if (Number.isFinite(rate) && Number.isFinite(hours)) {
        totalPay += rate * hours;
      }
    }

    return { totalHours, totalPay };
  }, [filteredLaborLogs]);

  const materialTotalPages = useMemo(
    () => Math.max(1, Math.ceil(materialExpenses.length / materialPageSize)),
    [materialExpenses.length, materialPageSize]
  );

  const pagedMaterialExpenses = useMemo(() => {
    const startIndex = (materialPage - 1) * materialPageSize;
    return materialExpenses.slice(startIndex, startIndex + materialPageSize);
  }, [materialExpenses, materialPage, materialPageSize]);

  const laborTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredLaborLogs.length / laborPageSize)),
    [filteredLaborLogs.length, laborPageSize]
  );

  const pagedLaborLogs = useMemo(() => {
    const startIndex = (laborPage - 1) * laborPageSize;
    return filteredLaborLogs.slice(startIndex, startIndex + laborPageSize);
  }, [filteredLaborLogs, laborPage, laborPageSize]);

  useEffect(() => {
    setMaterialPage((prev) => Math.min(prev, materialTotalPages));
  }, [materialTotalPages]);

  useEffect(() => {
    setLaborPage((prev) => Math.min(prev, laborTotalPages));
  }, [laborTotalPages]);

  useEffect(() => {
    setLaborPage(1);
  }, [laborLogPersonFilter, laborLogStartDate, laborLogEndDate]);

  const timesheetColumns = useMemo(() => {
    const dateColumns = weekDates.map((date) =>
      columnHelper.display({
        id: date,
        header: () => {
          const parts = formatMonthDayWithWeekday(date);
          return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span>{parts.monthDay}</span>
              {parts.weekday ? <span className="text-zinc-400 normal-case">{parts.weekday}</span> : null}
            </span>
          );
        },
        cell: ({ row }) => (
          <input
            value={row.original.hoursByDate[date] ?? ""}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "").slice(0, 2);
              const next = raw !== "" && Number(raw) === 0 ? "" : raw;
              const personId = row.original.personId;
              setTimesheetRows((prev) => {
                return prev.map((entry) => {
                  if (entry.personId !== personId) {
                    return entry;
                  }

                  return {
                    ...entry,
                    hoursByDate: {
                      ...entry.hoursByDate,
                      [date]: next,
                    },
                  };
                });
              });
            }}
            type="text"
            maxLength={2}
            inputMode="decimal"
            className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
        ),
      })
    );

    return [
      columnHelper.accessor("personId", {
        header: "Person",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-zinc-900">{row.original.personName}</p>
          </div>
        ),
      }),
      columnHelper.display({
        id: "payRate",
        header: "Pay Rate",
        cell: ({ row }) => (
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
            <input
              value={row.original.payRate}
              onChange={(event) => {
                const next = event.target.value;
                const personId = row.original.personId;
                setTimesheetRows((prev) => {
                  return prev.map((entry) => (entry.personId === personId ? { ...entry, payRate: next } : entry));
                });
              }}
              inputMode="decimal"
              className="w-24 rounded-lg border border-zinc-300 bg-white py-1 pl-5 pr-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </div>
        ),
      }),
      ...dateColumns,
      columnHelper.display({
        id: "totalPay",
        header: "Total Pay",
        cell: ({ row }) => {
          const payRate = Number(row.original.payRate);
          const totalHours = weekDates.reduce((sum, date) => {
            const value = Number(row.original.hoursByDate[date] ?? 0);
            if (!Number.isFinite(value) || value <= 0) {
              return sum;
            }
            return sum + value;
          }, 0);

          if (!Number.isFinite(payRate) || payRate <= 0 || totalHours <= 0) {
            return <span className="text-zinc-500">-</span>;
          }

          return <span className="font-semibold text-zinc-900">{formatCurrency(totalHours * payRate)}</span>;
        },
      }),
    ];
  }, [weekDates]);

  const timesheetTable = useReactTable({
    data: timesheetRows,
    columns: timesheetColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function onSaveTimesheet() {
    setFormError(null);
    setFormMessage(null);

    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setFormError("You need to be logged in to save timesheet data.");
      return;
    }

    const entries: Array<{
      id?: string;
      person_id: string;
      work_date: string;
      hours_worked: number;
      pay_rate_applied: number;
    }> = [];
    const deleteIds: string[] = [];

    for (const row of timesheetRows) {
      const payRate = Number(row.payRate);
      let hasPositiveHours = false;

      for (const date of weekDates) {
        const hoursRaw = row.hoursByDate[date];
        const existingEntryId = row.entryIdsByDate[date];

        if (!hoursRaw || hoursRaw.trim() === "") {
          if (existingEntryId) {
            deleteIds.push(existingEntryId);
          }
          continue;
        }

        const hours = Number(hoursRaw);
        if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
          setFormError(`Hours for ${row.personId} on ${date} must be between 0 and 24.`);
          return;
        }

        if (hours === 0) {
          continue;
        }

        hasPositiveHours = true;

        if (!Number.isFinite(payRate) || payRate <= 0) {
          setFormError(`Pay rate for person ${row.personId} must be greater than 0.`);
          return;
        }

        entries.push({
          id: existingEntryId,
          person_id: row.personId,
          work_date: date,
          hours_worked: hours,
          pay_rate_applied: payRate,
        });
      }

      if (hasPositiveHours && (!Number.isFinite(payRate) || payRate <= 0)) {
        setFormError(`Pay rate for person ${row.personId} must be greater than 0.`);
        return;
      }
    }

    if (entries.length === 0 && deleteIds.length === 0) {
      setFormError("Enter at least one hours value before saving.");
      return;
    }

    setIsSavingTimesheet(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/labor-log/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries, deleteIds }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setFormError(payload.message ?? "Unable to save timesheet entries.");
        return;
      }

      setFormMessage("Timesheet saved successfully.");
      await loadProjectDetails();
    } catch {
      setFormError("Unable to save timesheet right now.");
    } finally {
      setIsSavingTimesheet(false);
    }
  }

  function addTimesheetRow() {
    const personId = selectedPersonId.trim();
    if (!personId) {
      setFormError("Select a worker before adding a row.");
      return;
    }

    if (timesheetRows.some((row) => row.personId === personId)) {
      setFormError("That person is already in the grid.");
      return;
    }

    setTimesheetRows((prev) => [
      ...prev,
      {
        personId,
        personName: personnelById.get(personId)?.name ?? personId,
        payRate: String(personnelById.get(personId)?.default_rate ?? 0),
        hoursByDate: {},
        entryIdsByDate: {},
      },
    ]);
    setSelectedPersonId("");
    setFormError(null);
  }

  async function uploadReceiptPdf(file: File, token: string): Promise<{ path?: string; error?: string }> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: "Supabase environment is not configured for storage uploads." };
    }

    if (!projectId) {
      return { error: "Project id is required to upload receipts." };
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return { error: "Receipt file must be a PDF." };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${projectId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const response = await fetch(`${supabaseUrl}/storage/v1/object/receipts/${storagePath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        "x-upsert": "false",
        "Content-Type": "application/pdf",
      },
      body: file,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      return {
        error: payload.message ?? payload.error ?? "Unable to upload receipt PDF.",
      };
    }

    return { path: storagePath };
  }

  function normalizeReceiptStoragePath(rawPath: string): string {
    let path = rawPath.trim().replace(/^\/+/, "");
    if (path.startsWith("receipts/")) {
      path = path.slice("receipts/".length);
    }
    return path;
  }

  function getReceiptFileName(rawPath: string): string {
    const normalized = normalizeReceiptStoragePath(rawPath);
    const parts = normalized.split("/").filter(Boolean);
    const fileName = parts[parts.length - 1];
    return fileName || "receipt.pdf";
  }

  async function fetchReceiptBlob(storagePath: string, token: string): Promise<{ blob?: Blob; error?: string }> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: "Supabase environment is not configured for storage downloads." };
    }

    const normalizedPath = normalizeReceiptStoragePath(storagePath);
    if (!normalizedPath) {
      return { error: "Receipt path is invalid." };
    }

    const encodedPath = normalizedPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const response = await fetch(`${supabaseUrl}/storage/v1/object/receipts/${encodedPath}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      return {
        error: payload.message ?? payload.error ?? "Unable to fetch receipt file.",
      };
    }

    const blob = await response.blob();
    return { blob };
  }

  async function onViewReceipt(expenseId: string, storagePath: string) {
    setReceiptActionError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setReceiptActionError("Session expired. Please login again.");
      return;
    }

    setReceiptActionId(expenseId);

    try {
      const result = await fetchReceiptBlob(storagePath, token);
      if (result.error || !result.blob) {
        setReceiptActionError(result.error ?? "Unable to open receipt.");
        return;
      }

      const objectUrl = URL.createObjectURL(result.blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setReceiptActionError("Unable to open receipt right now.");
    } finally {
      setReceiptActionId(null);
    }
  }

  async function onDownloadReceipt(expenseId: string, storagePath: string) {
    setReceiptActionError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setReceiptActionError("Session expired. Please login again.");
      return;
    }

    setReceiptActionId(expenseId);

    try {
      const result = await fetchReceiptBlob(storagePath, token);
      if (result.error || !result.blob) {
        setReceiptActionError(result.error ?? "Unable to download receipt.");
        return;
      }

      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getReceiptFileName(storagePath);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setReceiptActionError("Unable to download receipt right now.");
    } finally {
      setReceiptActionId(null);
    }
  }

  async function onInlineReceiptFileSelected(expenseId: string, file: File | null) {
    setReceiptActionError(null);

    if (!file) {
      return;
    }

    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setReceiptActionError("Session expired. Please login again.");
      return;
    }

    setUploadingInlineReceiptId(expenseId);

    try {
      const uploadResult = await uploadReceiptPdf(file, token);
      if (uploadResult.error || !uploadResult.path) {
        setReceiptActionError(uploadResult.error ?? "Unable to upload receipt PDF.");
        return;
      }

      const response = await fetch(`/api/projects/${projectId}/material-expenses/${expenseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receipt_path: uploadResult.path }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        materialExpense?: MaterialExpense;
        message?: string;
      };

      if (!response.ok) {
        setReceiptActionError(payload.message ?? "Unable to save receipt path for this row.");
        return;
      }

      if (payload.materialExpense) {
        setMaterialExpenses((prev) =>
          prev.map((entry) => (entry.id === payload.materialExpense!.id ? payload.materialExpense! : entry))
        );
      }
    } catch {
      setReceiptActionError("Unable to upload receipt right now.");
    } finally {
      setUploadingInlineReceiptId(null);
    }
  }

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
      let finalReceiptPath = receiptPath.trim() === "" ? undefined : receiptPath.trim();

      if (receiptFile) {
        const uploadResult = await uploadReceiptPdf(receiptFile, token);
        if (uploadResult.error) {
          setFormError(uploadResult.error);
          return;
        }

        finalReceiptPath = uploadResult.path;
      }

      const response = await fetch(`/api/projects/${projectId}/material-expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: expenseName,
          description: expenseDescription,
          cost,
          vendor_id: vendorId.trim() === "" ? undefined : vendorId,
          receipt_path: finalReceiptPath,
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

      setExpenseName("");
      setExpenseDescription("");
      setCost("");
      setVendorId("");
      setReceiptPath("");
      setReceiptFile(null);
      setPurchaseDate("");
      setShowExpenseForm(false);
      setFormMessage("Material expense added successfully.");
    } catch {
      setFormError("Unable to create material expense right now.");
    } finally {
      setIsSavingExpense(false);
    }
  }

  async function onSaveProjectStatus() {
    setStatusError(null);
    setStatusMessage(null);

    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId || !project) {
      setStatusError("Unable to update project status right now.");
      return;
    }

    if (!projectStatusOptions.includes(statusDraft as (typeof projectStatusOptions)[number])) {
      setStatusError("Select a valid status.");
      return;
    }

    setIsSavingStatus(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: statusDraft }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        project?: Project;
        message?: string;
      };

      if (!response.ok) {
        setStatusError(payload.message ?? "Unable to update project status.");
        return;
      }

      if (payload.project) {
        setProject(payload.project);
        setStatusDraft(payload.project.status);
      } else {
        setProject({ ...project, status: statusDraft });
      }

      setStatusMessage("Project status updated.");
    } catch {
      setStatusError("Unable to update project status right now.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onSaveInvestmentDetails() {
    setCategoryDetailsError(null);
    setCategoryDetailsMessage(null);

    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setCategoryDetailsError("Unable to save project investment details right now.");
      return;
    }

    setIsSavingCategoryDetails(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/investment`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          purchase_price: purchasePrice,
          closing_costs: closingCosts,
          loan_amount: loanAmount,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        projectInvestment?: {
          purchase_price: number | null;
          closing_costs: number | null;
          loan_amount: number | null;
        };
        message?: string;
      };

      if (!response.ok) {
        setCategoryDetailsError(payload.message ?? "Unable to save project investment details.");
        return;
      }

      setPurchasePrice(String(payload.projectInvestment?.purchase_price ?? (Number(purchasePrice) || 0)));
      setClosingCosts(String(payload.projectInvestment?.closing_costs ?? (Number(closingCosts) || 0)));
      setLoanAmount(String(payload.projectInvestment?.loan_amount ?? (Number(loanAmount) || 0)));
      setCategoryDetailsMessage("Project investment details saved.");
    } catch {
      setCategoryDetailsError("Unable to save project investment details right now.");
    } finally {
      setIsSavingCategoryDetails(false);
    }
  }

  async function onSaveContractDetails() {
    setCategoryDetailsError(null);
    setCategoryDetailsMessage(null);

    const token = window.localStorage.getItem("access_token");
    if (!token || !projectId) {
      setCategoryDetailsError("Unable to save project contract details right now.");
      return;
    }

    setIsSavingCategoryDetails(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/contract`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_name: clientName,
          payment_terms: paymentTerms,
          total_contract_value: totalContractValue,
          amount_paid: amountPaid,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        projectContract?: {
          client_name: string | null;
          payment_terms: string | null;
          total_contract_value: number | null;
          amount_paid: number | null;
        };
        message?: string;
      };

      if (!response.ok) {
        setCategoryDetailsError(payload.message ?? "Unable to save project contract details.");
        return;
      }

      setClientName(payload.projectContract?.client_name ?? clientName);
  setPaymentTerms(payload.projectContract?.payment_terms ?? paymentTerms);
      setTotalContractValue(String(payload.projectContract?.total_contract_value ?? (Number(totalContractValue) || 0)));
  setAmountPaid(String(payload.projectContract?.amount_paid ?? (Number(amountPaid) || 0)));
      setCategoryDetailsMessage("Project contract details saved.");
    } catch {
      setCategoryDetailsError("Unable to save project contract details right now.");
    } finally {
      setIsSavingCategoryDetails(false);
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
          <button
            type="button"
            onClick={() => setActiveTab("project-details")}
            aria-label="Edit project details"
            title="Edit project details"
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
              activeTab === "project-details"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900 hover:text-zinc-900"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>

        {activeTab === "overview" ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-zinc-900">Project Overview</h3>
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Project Details</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div>
                    <dt className="text-sm text-zinc-500">Total Spent</dt>
                    <dd className="mt-1 text-base font-semibold text-zinc-900">{formatCurrency(totalSpent)}</dd>
                  </div>
                  {project.category === "fix-n-flip" || project.category === "rental" ? (
                    <>
                      <div>
                        <dt className="text-sm text-zinc-500">Purchase Price</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">
                          {formatCurrency(Number(purchasePrice) || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500">Closing Costs</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">
                          {formatCurrency(Number(closingCosts) || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500">Loan Amount</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">
                          {formatCurrency(Number(loanAmount) || 0)}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  {project.category === "contract_work" ? (
                    <>
                      <div>
                        <dt className="text-sm text-zinc-500">Client Name</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">{clientName.trim() || "Not set"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500">Payment Terms</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">{paymentTerms.trim() || "Not set"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500">Total Contract Value</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">
                          {formatCurrency(Number(totalContractValue) || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500">Amount Paid</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">
                          {formatCurrency(Number(amountPaid) || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-zinc-500">Contract Balance</dt>
                        <dd className="mt-1 text-base font-semibold text-zinc-900">
                          {formatCurrency((Number(totalContractValue) || 0) - (Number(amountPaid) || 0))}
                        </dd>
                      </div>
                    </>
                  ) : null}
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

          </div>
        ) : null}

        {activeTab === "project-details" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Project Status</p>
              <div className="mt-3 flex items-end gap-2">
                <label className="block flex-1">
                  <span className="mb-1 block text-xs font-medium text-zinc-600">Status</span>
                  <select
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    {projectStatusOptions.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={onSaveProjectStatus}
                  disabled={isSavingStatus || statusDraft === project.status}
                  className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isSavingStatus ? "Saving..." : "Update"}
                </button>
              </div>
              {statusError ? <p className="mt-2 text-xs font-medium text-red-700">{statusError}</p> : null}
              {statusMessage ? <p className="mt-2 text-xs font-medium text-emerald-700">{statusMessage}</p> : null}
            </div>

            {project.category === "fix-n-flip" || project.category === "rental" ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Project Investments</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zinc-700">Purchase Price</span>
                    <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
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
                    <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
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
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zinc-700">Loan Amount</span>
                    <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
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
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onSaveInvestmentDetails}
                    disabled={isSavingCategoryDetails}
                    className="w-fit rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {isSavingCategoryDetails ? "Saving..." : "Save Investments"}
                  </button>
                  {categoryDetailsError ? <p className="text-sm text-red-700">{categoryDetailsError}</p> : null}
                  {categoryDetailsMessage ? <p className="text-sm text-emerald-700">{categoryDetailsMessage}</p> : null}
                </div>
              </div>
            ) : null}

            {project.category === "contract_work" ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Project Contract</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-zinc-700">Client Name</span>
                    <input
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      placeholder="Client name"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-zinc-700">Payment Terms</span>
                    <input
                      value={paymentTerms}
                      onChange={(event) => setPaymentTerms(event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      placeholder="Net 30"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zinc-700">Total Contract Value</span>
                    <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
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
                    <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
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
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onSaveContractDetails}
                    disabled={isSavingCategoryDetails}
                    className="w-fit rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {isSavingCategoryDetails ? "Saving..." : "Save Contract"}
                  </button>
                  {categoryDetailsError ? <p className="text-sm text-red-700">{categoryDetailsError}</p> : null}
                  {categoryDetailsMessage ? <p className="text-sm text-emerald-700">{categoryDetailsMessage}</p> : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "material-expenses" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-600">Create a new material expense entry.</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseForm((prev) => !prev);
                    setFormError(null);
                    setFormMessage(null);
                  }}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  {showExpenseForm ? "Close Form" : "Add Material Expense"}
                </button>
              </div>
            </div>

            {showExpenseForm ? (
              <form
                onSubmit={onCreateMaterialExpense}
                className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2 xl:grid-cols-3"
              >
                <label className="block xl:col-span-3">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">
                    Name <span className="text-red-600">*</span>
                  </span>
                  <input
                    value={expenseName}
                    onChange={(event) => setExpenseName(event.target.value)}
                    placeholder="PO/Job name or Item"
                    required
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>

                <label className="block xl:col-span-3">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Description</span>
                  <textarea
                    value={expenseDescription}
                    onChange={(event) => setExpenseDescription(event.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">
                    Cost <span className="text-red-600">*</span>
                  </span>
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
                    <span className="font-medium text-zinc-500">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={cost}
                      onChange={(event) => setCost(event.target.value)}
                      placeholder="1250.00"
                      required
                      className="w-full bg-transparent outline-none"
                    />
                  </label>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Vendor</span>
                  <select
                    value={vendorId}
                    onChange={(event) => setVendorId(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="">Optional vendor...</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">
                    Purchase Date <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(event) => setPurchaseDate(event.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>

                <label className="block xl:col-span-3">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Receipt PDF</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-zinc-700"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Optional. Upload a PDF receipt to Supabase Storage bucket: receipts.
                  </p>
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
            ) : null}

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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-sm text-zinc-600">
                    Page {materialPage} of {materialTotalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <span>Rows</span>
                      <select
                        value={materialPageSize}
                        onChange={(event) => {
                          setMaterialPageSize(Number(event.target.value));
                          setMaterialPage(1);
                        }}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setMaterialPage((prev) => Math.max(1, prev - 1))}
                      disabled={materialPage <= 1}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialPage((prev) => Math.min(materialTotalPages, prev + 1))}
                      disabled={materialPage >= materialTotalPages}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Purchase Date</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {pagedMaterialExpenses.map((expense) => (
                        <tr key={expense.id} className="align-top">
                          <td className="px-4 py-3 font-medium text-zinc-900">{expense.name}</td>
                          <td className="px-4 py-3 text-zinc-600">{expense.description ?? "Not provided"}</td>
                          <td className="px-4 py-3 text-zinc-600">{formatMonthDay(expense.purchase_date)}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {expense.vendor_id ? (vendorsById.get(expense.vendor_id)?.name ?? expense.vendor_id) : "Not linked"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">{formatCurrency(expense.cost)}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {expense.receipt_path ? (
                              <div className="flex flex-col gap-2">
                                <p className="truncate text-xs text-zinc-500">{getReceiptFileName(expense.receipt_path)}</p>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onViewReceipt(expense.id, expense.receipt_path as string)}
                                    disabled={receiptActionId === expense.id}
                                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDownloadReceipt(expense.id, expense.receipt_path as string)}
                                    disabled={receiptActionId === expense.id}
                                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-zinc-500">Not uploaded</p>
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  onChange={(event) => onInlineReceiptFileSelected(expense.id, event.target.files?.[0] ?? null)}
                                  disabled={uploadingInlineReceiptId === expense.id}
                                  className="w-full max-w-[240px] rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs outline-none transition file:mr-2 file:rounded-md file:border-0 file:bg-zinc-900 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white hover:file:bg-zinc-700"
                                />
                                {uploadingInlineReceiptId === expense.id ? (
                                  <p className="text-xs font-medium text-zinc-600">Uploading...</p>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}

            {receiptActionError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{receiptActionError}</p>
            ) : null}
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

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Timesheet Grid</p>
              <p className="mt-2 text-sm text-zinc-600">
                Enter hours by person and day. Use the week start picker to change the visible week.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Week Start (Monday)</span>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(event) => setWeekStart(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Add Worker Row</span>
                  <select
                    value={selectedPersonId}
                    onChange={(event) => setSelectedPersonId(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="">Select worker...</option>
                    {personnel.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                        {person.worker_type ? ` (${person.worker_type})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={addTimesheetRow}
                  className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-900"
                >
                  Add Row
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {timesheetTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th key={header.id} className="whitespace-nowrap px-3 py-3">
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {timesheetTable.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-zinc-600" colSpan={Math.max(timesheetColumns.length, 1)}>
                            No people in this week yet. Add a person row to start entering hours.
                          </td>
                        </tr>
                      ) : (
                        timesheetTable.getRowModel().rows.map((row) => (
                          <tr key={row.id} className="align-top">
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="px-3 py-2">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onSaveTimesheet}
                  disabled={isSavingTimesheet}
                  className="w-fit rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isSavingTimesheet ? "Saving..." : "Save Timesheet"}
                </button>

                {formError ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
                ) : null}
                {formMessage ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{formMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block w-full max-w-[11rem]">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Filter Person</span>
                  <select
                    value={laborLogPersonFilter}
                    onChange={(event) => setLaborLogPersonFilter(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="all">All people</option>
                    <option value="unassigned">Unassigned</option>
                    {laborLogPersonOptions.map((personOption) => (
                      <option key={personOption.id} value={personOption.id}>
                        {personOption.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block w-full max-w-[11rem]">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Start Date</span>
                  <input
                    type="date"
                    value={laborLogStartDate}
                    onChange={(event) => setLaborLogStartDate(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>

                <label className="block w-full max-w-[11rem]">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">End Date</span>
                  <input
                    type="date"
                    value={laborLogEndDate}
                    onChange={(event) => setLaborLogEndDate(event.target.value)}
                    min={laborLogStartDate || undefined}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setLaborLogPersonFilter("all");
                    setLaborLogStartDate("");
                    setLaborLogEndDate("");
                  }}
                  className="h-[46px] whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 outline-none transition hover:border-zinc-400 hover:text-zinc-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Total Hours</p>
                  <p className="mt-0.5 text-base font-semibold text-zinc-900">
                    {filteredLaborSummary.totalHours.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Total Pay</p>
                  <p className="mt-0.5 text-base font-semibold text-zinc-900">{formatCurrency(filteredLaborSummary.totalPay)}</p>
                </div>
              </div>
            </div>

            {filteredLaborLogs.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                No labor log entries match the selected filters.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-sm text-zinc-600">
                    Page {laborPage} of {laborTotalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <span>Rows</span>
                      <select
                        value={laborPageSize}
                        onChange={(event) => {
                          setLaborPageSize(Number(event.target.value));
                          setLaborPage(1);
                        }}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setLaborPage((prev) => Math.max(1, prev - 1))}
                      disabled={laborPage <= 1}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaborPage((prev) => Math.min(laborTotalPages, prev + 1))}
                      disabled={laborPage >= laborTotalPages}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

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
                      {pagedLaborLogs.map((entry) => (
                        <tr key={entry.id} className="align-top">
                          <td className="px-4 py-3 text-zinc-600">{formatMonthDay(entry.work_date)}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {entry.person_id ? (personnelById.get(entry.person_id)?.name ?? "Unknown personnel") : "Not linked"}
                          </td>
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
              </div>
            )}
          </section>
        ) : null}
      </section>
    </div>
  );
}
