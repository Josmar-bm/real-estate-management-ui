import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type MaterialExpenseUpdateBody = {
  receipt_path?: unknown;
};

type MaterialExpenseRecord = {
  id: string;
  project_id: string;
  vendor_id: string | null;
  name: string;
  description: string | null;
  cost: number;
  receipt_path: string | null;
  purchase_date: string | null;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; expenseId: string }> }
) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const { id: projectId, expenseId } = await context.params;
    if (!projectId || !expenseId) {
      return NextResponse.json({ message: "Project id and expense id are required." }, { status: 400 });
    }

    let body: MaterialExpenseUpdateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const receiptPath = String(body.receipt_path ?? "").trim();
    if (!receiptPath) {
      return NextResponse.json({ message: "receipt_path is required." }, { status: 400 });
    }

    const endpoint = `${config.supabaseUrl}/rest/v1/material_expenses?id=eq.${encodeURIComponent(expenseId)}&project_id=eq.${encodeURIComponent(projectId)}`;

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ receipt_path: receiptPath }),
    });

    const payload = (await response.json().catch(() => [])) as
      | MaterialExpenseRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to update receipt path.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [materialExpense] = payload as MaterialExpenseRecord[];
    if (!materialExpense) {
      return NextResponse.json({ message: "Material expense not found." }, { status: 404 });
    }

    return NextResponse.json({ materialExpense });
  });
}
