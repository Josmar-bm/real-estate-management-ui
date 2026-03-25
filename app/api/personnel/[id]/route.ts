import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type PersonnelBody = {
  name?: unknown;
  worker_type?: unknown;
  default_rate?: unknown;
};

const allowedWorkerTypes = ["employee", "sub-contractor", "other"] as const;

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function parseRequiredNumericField(value: unknown, fieldName: string): { value?: number; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { error: `${fieldName} is required.` };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { error: `${fieldName} must be a valid number.` };
  }

  return { value: numericValue };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ message: "Personnel id is required." }, { status: 400 });
    }

    let body: PersonnelBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const name = String(body.name ?? "").trim();
    const workerType = String(body.worker_type ?? "").trim();

    if (!name) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    if (!workerType) {
      return NextResponse.json({ message: "Worker type is required." }, { status: 400 });
    }

    if (!allowedWorkerTypes.includes(workerType as (typeof allowedWorkerTypes)[number])) {
      return NextResponse.json(
        { message: "Worker type must be one of: employee, sub-contractor, other." },
        { status: 400 }
      );
    }

    const defaultRate = parseRequiredNumericField(body.default_rate, "Default rate");
    if (defaultRate.error) {
      return NextResponse.json({ message: defaultRate.error }, { status: 400 });
    }

    const updatePayload: {
      name: string;
      worker_type: string;
      default_rate: number;
    } = {
      name,
      worker_type: workerType,
      default_rate: defaultRate.value ?? 0,
    };

    const response = await fetch(`${config.supabaseUrl}/rest/v1/personnel?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(updatePayload),
    });

    const payload = (await response.json().catch(() => [])) as
      | Array<{ id: string; name: string; worker_type: string | null; default_rate: number | null }>
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to update personnel.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [person] = payload as Array<{ id: string; name: string; worker_type: string | null; default_rate: number | null }>;
    if (!person) {
      return NextResponse.json({ message: "Personnel record not found." }, { status: 404 });
    }

    return NextResponse.json({ personnel: person });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ message: "Personnel id is required." }, { status: 400 });
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/personnel?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      return NextResponse.json(
        {
          message: payload.message ?? payload.details ?? "Unable to delete personnel.",
          details: payload.details,
          hint: payload.hint,
          code: payload.code,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ deleted: true });
  });
}
