import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type InvestmentBody = {
  purchase_price?: unknown;
  closing_costs?: unknown;
  loan_amount?: unknown;
};

type ProjectInvestmentRecord = {
  project_id: string;
  purchase_price: number;
  closing_costs: number;
  loan_amount: number;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function parseOptionalNumeric(value: unknown, fieldName: string): { value?: number; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { value: undefined };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { error: `${fieldName} must be a valid number.` };
  }

  return { value: numericValue };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ message: "Project id is required." }, { status: 400 });
    }

    let body: InvestmentBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const purchasePrice = parseOptionalNumeric(body.purchase_price, "Purchase price");
    const closingCosts = parseOptionalNumeric(body.closing_costs, "Closing costs");
    const loanAmount = parseOptionalNumeric(body.loan_amount, "Loan amount");

    if (purchasePrice.error || closingCosts.error || loanAmount.error) {
      return NextResponse.json(
        {
          message: purchasePrice.error ?? closingCosts.error ?? loanAmount.error,
        },
        { status: 400 }
      );
    }

    const recordToUpsert: ProjectInvestmentRecord = {
      project_id: projectId,
      purchase_price: purchasePrice.value ?? 0,
      closing_costs: closingCosts.value ?? 0,
      loan_amount: loanAmount.value ?? 0,
    };

    const response = await fetch(`${config.supabaseUrl}/rest/v1/project_investments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(recordToUpsert),
    });

    const payload = (await response.json().catch(() => [])) as
      | ProjectInvestmentRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to save project investment.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [projectInvestment] = payload as ProjectInvestmentRecord[];
    return NextResponse.json({ projectInvestment });
  });
}
