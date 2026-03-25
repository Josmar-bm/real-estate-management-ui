import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";

type LaborEntryInput = {
  id?: unknown;
  person_id?: unknown;
  work_date?: unknown;
  hours_worked?: unknown;
  pay_rate_applied?: unknown;
};

type LaborBulkBody = {
  entries?: unknown;
};

type LaborLogRecord = {
  id: string;
  project_id: string;
  person_id: string;
  work_date: string;
  hours_worked: number;
  pay_rate_applied: number;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

function toNonNegativeNumber(value: unknown, fieldName: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { error: `${fieldName} must be a non-negative number.` };
  }
  return { value: numericValue };
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) {
    return { error: "work_date is required." };
  }
  if (Number.isNaN(Date.parse(text))) {
    return { error: "work_date must be a valid date." };
  }
  return { value: text.slice(0, 10) };
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

    let body: LaborBulkBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json({ message: "entries must be a non-empty array." }, { status: 400 });
    }

    const rows: LaborLogRecord[] = [];

    for (const rawEntry of body.entries) {
      const entry = rawEntry as LaborEntryInput;

      const personId = String(entry.person_id ?? "").trim();
      if (!personId) {
        return NextResponse.json({ message: "person_id is required for all entries." }, { status: 400 });
      }

      const workDate = normalizeDate(entry.work_date);
      if (workDate.error) {
        return NextResponse.json({ message: workDate.error }, { status: 400 });
      }

      const hours = toNonNegativeNumber(entry.hours_worked, "hours_worked");
      if (hours.error) {
        return NextResponse.json({ message: hours.error }, { status: 400 });
      }

      if ((hours.value ?? 0) > 24) {
        return NextResponse.json(
          { message: "hours_worked must be less than or equal to 24." },
          { status: 400 }
        );
      }

      const payRate = toNonNegativeNumber(entry.pay_rate_applied, "pay_rate_applied");
      if (payRate.error) {
        return NextResponse.json({ message: payRate.error }, { status: 400 });
      }

      rows.push({
        id: String(entry.id ?? "").trim() || randomUUID(),
        project_id: projectId,
        person_id: personId,
        work_date: workDate.value ?? "",
        hours_worked: hours.value ?? 0,
        pay_rate_applied: payRate.value ?? 0,
      });
    }

    const endpoint = `${config.supabaseUrl}/rest/v1/labor_log?on_conflict=id`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    });

    const payload = (await response.json().catch(() => [])) as
      | LaborLogRecord[]
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to save labor log entries.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ laborLogs: payload as LaborLogRecord[] }, { status: 200 });
  });
}
