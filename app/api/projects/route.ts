import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";

type ProjectBody = {
  name?: unknown;
  status?: unknown;
  category?: unknown;
  total_budget?: unknown;
  start_date?: unknown;
  purchase_price?: unknown;
  closing_costs?: unknown;
  loan_amount?: unknown;
  client_name?: unknown;
  payment_terms?: unknown;
  total_contract_value?: unknown;
  amount_paid?: unknown;
};

type ProjectCategory = "fix-n-flip" | "rental" | "contract_work";
type ProjectStatus = "planning" | "in-progress" | "on-hold" | "completed";

type ProjectRecord = {
  id: string;
  name: string;
  status: string;
  category: ProjectCategory;
  total_budget: number | null;
  start_date: string | null;
};

type ProjectInvestmentInsert = {
  project_id: string;
  purchase_price: number;
  closing_costs: number;
  loan_amount: number;
};

type ProjectContractInsert = {
  project_id: string;
  client_name: string | null;
  payment_terms: string | null;
  total_contract_value: number;
  amount_paid: number;
};

const allowedCategories: ProjectCategory[] = ["fix-n-flip", "rental", "contract_work"];
const allowedStatuses: ProjectStatus[] = ["planning", "in-progress", "on-hold", "completed"];

function parseOptionalNumericField(value: unknown, fieldName: string): { value?: number; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { value: undefined };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { error: `${fieldName} must be a valid number.` };
  }

  return { value: numericValue };
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function GET(request: Request) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/projects?select=id,name,status,category,total_budget,start_date&order=start_date.desc`,
      {
        method: "GET",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const payload = (await response.json().catch(() => [])) as
      | ProjectRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      const message = errorPayload.message ?? "Unable to load projects.";
      return NextResponse.json(
        {
          message,
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ projects: payload as ProjectRecord[] });
  });
}

export async function POST(request: Request) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    let body: ProjectBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const name = String(body.name ?? "").trim();
    const status = String(body.status ?? "").trim() as ProjectStatus;
    const category = String(body.category ?? "").trim() as ProjectCategory;
    const startDate = String(body.start_date ?? "").trim();

    if (!name) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ message: "Status is required." }, { status: 400 });
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { message: "Status must be one of: planning, in-progress, on-hold, completed." },
        { status: 400 }
      );
    }

    if (!allowedCategories.includes(category)) {
      return NextResponse.json(
        { message: "Category must be one of: fix-n-flip, rental, contract_work." },
        { status: 400 }
      );
    }

    const totalBudget = parseOptionalNumericField(body.total_budget, "Total budget");
    if (totalBudget.error) {
      return NextResponse.json({ message: totalBudget.error }, { status: 400 });
    }

    if (startDate && Number.isNaN(Date.parse(startDate))) {
      return NextResponse.json({ message: "Start date must be a valid date." }, { status: 400 });
    }

    const purchasePrice = parseOptionalNumericField(body.purchase_price, "Purchase price");
    const closingCosts = parseOptionalNumericField(body.closing_costs, "Closing costs");
    const loanAmount = parseOptionalNumericField(body.loan_amount, "Loan amount");
    const totalContractValue = parseOptionalNumericField(body.total_contract_value, "Total contract value");
    const amountPaid = parseOptionalNumericField(body.amount_paid, "Amount paid");
    const clientName = String(body.client_name ?? "").trim();
    const paymentTerms = String(body.payment_terms ?? "").trim();

    if ((category === "fix-n-flip" || category === "rental") && purchasePrice.error) {
      return NextResponse.json({ message: purchasePrice.error }, { status: 400 });
    }

    if ((category === "fix-n-flip" || category === "rental") && closingCosts.error) {
      return NextResponse.json({ message: closingCosts.error }, { status: 400 });
    }

    if ((category === "fix-n-flip" || category === "rental") && loanAmount.error) {
      return NextResponse.json({ message: loanAmount.error }, { status: 400 });
    }

    if (category === "contract_work" && totalContractValue.error) {
      return NextResponse.json({ message: totalContractValue.error }, { status: 400 });
    }

    if (category === "contract_work" && amountPaid.error) {
      return NextResponse.json({ message: amountPaid.error }, { status: 400 });
    }

    const projectToInsert: {
      id: string;
      name: string;
      status: ProjectStatus;
      category: ProjectCategory;
      total_budget?: number;
      start_date?: string;
    } = {
      id: randomUUID(),
      name,
      status,
      category,
    };

    if (totalBudget.value !== undefined) {
      projectToInsert.total_budget = totalBudget.value;
    }

    if (startDate) {
      projectToInsert.start_date = startDate;
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(projectToInsert),
    });

    const payload = (await response.json().catch(() => [])) as
      | ProjectRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      const message = errorPayload.message ?? errorPayload.details ?? "Unable to create project.";
      return NextResponse.json(
        {
          message,
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [project] = payload as ProjectRecord[];

    if (category === "fix-n-flip" || category === "rental") {
      const investmentRecord: ProjectInvestmentInsert = {
        project_id: project.id,
        purchase_price: purchasePrice.value ?? 0,
        closing_costs: closingCosts.value ?? 0,
        loan_amount: loanAmount.value ?? 0,
      };

      const investmentResponse = await fetch(`${config.supabaseUrl}/rest/v1/project_investments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(investmentRecord),
      });

      if (!investmentResponse.ok) {
        const errorPayload = (await investmentResponse.json().catch(() => ({}))) as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        await fetch(`${config.supabaseUrl}/rest/v1/projects?id=eq.${project.id}`, {
          method: "DELETE",
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => null);

        return NextResponse.json(
          {
            message: errorPayload.message ?? errorPayload.details ?? "Unable to create project investment details.",
            details: errorPayload.details,
            hint: errorPayload.hint,
            code: errorPayload.code,
          },
          { status: investmentResponse.status }
        );
      }
    }

    if (category === "contract_work") {
      const contractRecord: ProjectContractInsert = {
        project_id: project.id,
        client_name: clientName || null,
        payment_terms: paymentTerms || null,
        total_contract_value: totalContractValue.value ?? 0,
        amount_paid: amountPaid.value ?? 0,
      };

      const contractResponse = await fetch(`${config.supabaseUrl}/rest/v1/project_contracts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(contractRecord),
      });

      if (!contractResponse.ok) {
        const errorPayload = (await contractResponse.json().catch(() => ({}))) as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        await fetch(`${config.supabaseUrl}/rest/v1/projects?id=eq.${project.id}`, {
          method: "DELETE",
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => null);

        return NextResponse.json(
          {
            message: errorPayload.message ?? errorPayload.details ?? "Unable to create project contract details.",
            details: errorPayload.details,
            hint: errorPayload.hint,
            code: errorPayload.code,
          },
          { status: contractResponse.status }
        );
      }
    }

    return NextResponse.json({ project }, { status: 201 });
  });
}
