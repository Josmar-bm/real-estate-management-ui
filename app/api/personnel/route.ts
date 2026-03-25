import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";

type PersonnelRecord = {
  id: string;
  name: string;
  worker_type: string;
  default_rate: number;
};

type PersonnelBody = {
  name?: unknown;
  worker_type?: unknown;
  default_rate?: unknown;
};

const allowedWorkerTypes = ["employee", "sub-contractor", "other"] as const;

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

    const endpoint = `${config.supabaseUrl}/rest/v1/personnel?select=id,name,worker_type,default_rate&order=name.asc`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json().catch(() => [])) as
      | PersonnelRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to load personnel.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ personnel: payload as PersonnelRecord[] });
  });
}

export async function POST(request: Request) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
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

    const personnelToInsert: {
      id: string;
      name: string;
      worker_type: string;
      default_rate: number;
    } = {
      id: randomUUID(),
      name,
      worker_type: workerType,
      default_rate: defaultRate.value ?? 0,
    };

    const response = await fetch(`${config.supabaseUrl}/rest/v1/personnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(personnelToInsert),
    });

    const payload = (await response.json().catch(() => [])) as
      | PersonnelRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to create personnel.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [personnel] = payload as PersonnelRecord[];
    return NextResponse.json({ personnel }, { status: 201 });
  });
}
