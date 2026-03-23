import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";

type MaterialExpenseBody = {
  item_name?: unknown;
  cost?: unknown;
  vendor_id?: unknown;
  receipt_path?: unknown;
  purchase_date?: unknown;
};

type MaterialExpenseRecord = {
  id: string;
  project_id: string;
  vendor_id?: string;
  item_name: string;
  cost: number;
  receipt_path?: string;
  purchase_date?: string;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function parseRequiredNumericField(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return { error: `${fieldName} is required.` };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { error: `${fieldName} must be a valid number.` };
  }

  return { value: numericValue };
}

export async function POST(
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

    let body: MaterialExpenseBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const itemName = String(body.item_name ?? "").trim();
    const vendorId = String(body.vendor_id ?? "").trim();
    const receiptPath = String(body.receipt_path ?? "").trim();
    const purchaseDate = String(body.purchase_date ?? "").trim();
    const cost = parseRequiredNumericField(body.cost, "Cost");

    if (!itemName) {
      return NextResponse.json({ message: "Item name is required." }, { status: 400 });
    }

    if (cost.error) {
      return NextResponse.json({ message: cost.error }, { status: 400 });
    }

    if (purchaseDate && Number.isNaN(Date.parse(purchaseDate))) {
      return NextResponse.json({ message: "Purchase date must be a valid date." }, { status: 400 });
    }

    const expenseToInsert: MaterialExpenseRecord = {
      id: randomUUID(),
      project_id: projectId,
      item_name: itemName,
      cost: cost.value ?? 0,
    };

    if (vendorId) {
      expenseToInsert.vendor_id = vendorId;
    }

    if (receiptPath) {
      expenseToInsert.receipt_path = receiptPath;
    }

    if (purchaseDate) {
      expenseToInsert.purchase_date = purchaseDate;
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/material_expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(expenseToInsert),
    });

    const payload = (await response.json().catch(() => [])) as
      | MaterialExpenseRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to create material expense.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [materialExpense] = payload as MaterialExpenseRecord[];
    return NextResponse.json({ materialExpense }, { status: 201 });
  });
}
