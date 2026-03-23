import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type ProjectCategory = "fix-n-flip" | "rental" | "contract_work";

type ProjectRecord = {
  id: string;
  name: string;
  status: string;
  category: ProjectCategory;
  total_budget: number | null;
  start_date: string | null;
};

type MaterialExpenseRecord = {
  id: string;
  project_id: string | null;
  vendor_id: string | null;
  item_name: string;
  cost: number;
  receipt_path: string | null;
  purchase_date: string | null;
};

type LaborLogRecord = {
  id: string;
  project_id: string | null;
  person_id: string | null;
  work_date: string | null;
  hours_worked: number | null;
  pay_rate_applied: number | null;
  total_labor_cost: number | null;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function buildHeaders(token: string, anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ message: "Project id is required." }, { status: 400 });
    }

    const projectUrl = new URL(`${config.supabaseUrl}/rest/v1/projects`);
    projectUrl.searchParams.set("select", "id,name,status,category,total_budget,start_date");
    projectUrl.searchParams.set("id", `eq.${id}`);
    projectUrl.searchParams.set("limit", "1");

    const expensesUrl = new URL(`${config.supabaseUrl}/rest/v1/material_expenses`);
    expensesUrl.searchParams.set(
      "select",
      "id,project_id,vendor_id,item_name,cost,receipt_path,purchase_date"
    );
    expensesUrl.searchParams.set("project_id", `eq.${id}`);
    expensesUrl.searchParams.set("order", "purchase_date.desc.nullslast");

    const laborLogUrl = new URL(`${config.supabaseUrl}/rest/v1/labor_log`);
    laborLogUrl.searchParams.set(
      "select",
      "id,project_id,person_id,work_date,hours_worked,pay_rate_applied,total_labor_cost"
    );
    laborLogUrl.searchParams.set("project_id", `eq.${id}`);
    laborLogUrl.searchParams.set("order", "work_date.desc.nullslast");

    const [projectResponse, expensesResponse, laborLogResponse] = await Promise.all([
      fetch(projectUrl.toString(), {
        method: "GET",
        headers: buildHeaders(token, config.supabaseAnonKey),
      }),
      fetch(expensesUrl.toString(), {
        method: "GET",
        headers: buildHeaders(token, config.supabaseAnonKey),
      }),
      fetch(laborLogUrl.toString(), {
        method: "GET",
        headers: buildHeaders(token, config.supabaseAnonKey),
      }),
    ]);

    const projectPayload = (await projectResponse.json().catch(() => [])) as
      | ProjectRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!projectResponse.ok) {
      const errorPayload = projectPayload as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      return NextResponse.json(
        {
          message: errorPayload.message ?? "Unable to load project.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: projectResponse.status }
      );
    }

    const [project] = projectPayload as ProjectRecord[];
    if (!project) {
      return NextResponse.json({ message: "Project not found." }, { status: 404 });
    }

    const expensesPayload = (await expensesResponse.json().catch(() => [])) as
      | MaterialExpenseRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!expensesResponse.ok) {
      const errorPayload = expensesPayload as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      return NextResponse.json(
        {
          message: errorPayload.message ?? "Unable to load material expenses.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: expensesResponse.status }
      );
    }

    const materialExpenses = expensesPayload as MaterialExpenseRecord[];
    const materialExpenseTotal = materialExpenses.reduce((sum, expense) => sum + Number(expense.cost ?? 0), 0);

    const laborPayload = (await laborLogResponse.json().catch(() => [])) as
      | LaborLogRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!laborLogResponse.ok) {
      const errorPayload = laborPayload as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      return NextResponse.json(
        {
          message: errorPayload.message ?? "Unable to load labor log.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: laborLogResponse.status }
      );
    }

    const laborLogs = laborPayload as LaborLogRecord[];
    const laborCostTotal = laborLogs.reduce((sum, entry) => sum + Number(entry.total_labor_cost ?? 0), 0);

    return NextResponse.json({
      project,
      materialExpenses,
      laborLogs,
      summary: {
        materialExpenseCount: materialExpenses.length,
        materialExpenseTotal,
        laborLogCount: laborLogs.length,
        laborCostTotal,
      },
    });
  });
}
