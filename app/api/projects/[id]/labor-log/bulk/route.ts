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
  deleteIds?: unknown;
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
      if (!Array.isArray(body.entries) && body.entries !== undefined) {
        return NextResponse.json({ message: "entries must be an array when provided." }, { status: 400 });
      }
    }

    if (!Array.isArray(body.deleteIds) && body.deleteIds !== undefined) {
      return NextResponse.json({ message: "deleteIds must be an array when provided." }, { status: 400 });
    }

    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    const rawDeleteIds = Array.isArray(body.deleteIds) ? body.deleteIds : [];

    if (rawEntries.length === 0 && rawDeleteIds.length === 0) {
      return NextResponse.json(
        { message: "Provide at least one entry to save or one id to delete." },
        { status: 400 }
      );
    }

    const rows: LaborLogRecord[] = [];
    const deleteIds: string[] = [];

    for (const rawEntry of rawEntries) {
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

    for (const rawId of rawDeleteIds) {
      const id = String(rawId ?? "").trim();
      if (!id) {
        continue;
      }

      if (!/^[a-zA-Z0-9-]+$/.test(id)) {
        return NextResponse.json({ message: "deleteIds contains an invalid id." }, { status: 400 });
      }

      deleteIds.push(id);
    }

    const uniqueDeleteIds = Array.from(new Set(deleteIds));

    let savedRows: LaborLogRecord[] = [];

    if (rows.length > 0) {
      const upsertEndpoint = `${config.supabaseUrl}/rest/v1/labor_log?on_conflict=id`;

      const upsertResponse = await fetch(upsertEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(rows),
      });

      const upsertPayload = (await upsertResponse.json().catch(() => [])) as
        | LaborLogRecord[]
        | { message?: string; details?: string; hint?: string; code?: string };

      if (!upsertResponse.ok) {
        const errorPayload = upsertPayload as { message?: string; details?: string; hint?: string; code?: string };
        return NextResponse.json(
          {
            message: errorPayload.message ?? errorPayload.details ?? "Unable to save labor log entries.",
            details: errorPayload.details,
            hint: errorPayload.hint,
            code: errorPayload.code,
          },
          { status: upsertResponse.status }
        );
      }

      savedRows = upsertPayload as LaborLogRecord[];
    }

    let actualDeletedCount = 0;

    if (uniqueDeleteIds.length > 0) {
      // Build the URL as a raw string to avoid URLSearchParams percent-encoding
      // the parens and commas in the PostgREST in.() filter syntax.
      const deleteUrl =
        `${config.supabaseUrl}/rest/v1/labor_log` +
        `?project_id=eq.${projectId}` +
        `&id=in.(${uniqueDeleteIds.join(",")})`;

      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Prefer: "return=representation",
        },
      });

      if (!deleteResponse.ok) {
        const deletePayload = (await deleteResponse.json().catch(() => ({}))) as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        return NextResponse.json(
          {
            message: deletePayload.message ?? deletePayload.details ?? "Unable to delete labor log entries.",
            details: deletePayload.details,
            hint: deletePayload.hint,
            code: deletePayload.code,
          },
          { status: deleteResponse.status }
        );
      }

      const deletedRows = (await deleteResponse.json().catch(() => [])) as LaborLogRecord[];
      actualDeletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;
    }

    return NextResponse.json(
      { laborLogs: savedRows, savedCount: rows.length, deletedCount: actualDeletedCount },
      { status: 200 }
    );
  });
}
