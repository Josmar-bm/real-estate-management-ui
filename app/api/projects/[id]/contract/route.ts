import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type ContractBody = {
  client_name?: unknown;
  payment_terms?: unknown;
  total_contract_value?: unknown;
  amount_paid?: unknown;
};

type ProjectContractRecord = {
  project_id: string;
  client_name: string | null;
  payment_terms: string | null;
  total_contract_value: number;
  amount_paid: number;
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

    let body: ContractBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const clientNameRaw = String(body.client_name ?? "").trim();
    const paymentTermsRaw = String(body.payment_terms ?? "").trim();
    const totalContractValue = parseOptionalNumeric(body.total_contract_value, "Total contract value");
    const amountPaid = parseOptionalNumeric(body.amount_paid, "Amount paid");

    if (totalContractValue.error) {
      return NextResponse.json({ message: totalContractValue.error }, { status: 400 });
    }

    if (amountPaid.error) {
      return NextResponse.json({ message: amountPaid.error }, { status: 400 });
    }

    const recordToUpsert: ProjectContractRecord = {
      project_id: projectId,
      client_name: clientNameRaw || null,
      payment_terms: paymentTermsRaw || null,
      total_contract_value: totalContractValue.value ?? 0,
      amount_paid: amountPaid.value ?? 0,
    };

    const response = await fetch(`${config.supabaseUrl}/rest/v1/project_contracts`, {
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
      | ProjectContractRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to save project contract.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [projectContract] = payload as ProjectContractRecord[];
    return NextResponse.json({ projectContract });
  });
}
