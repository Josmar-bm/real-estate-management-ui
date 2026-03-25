import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type VendorBody = {
  name?: unknown;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async ({ token }) => {
    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ message: "Vendor id is required." }, { status: 400 });
    }

    let body: VendorBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/vendors?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name }),
    });

    const payload = (await response.json().catch(() => [])) as
      | Array<{ id: string; name: string }>
      | { message?: string; details?: string; hint?: string; code?: string };

    if (!response.ok) {
      const errorPayload = payload as { message?: string; details?: string; hint?: string; code?: string };
      return NextResponse.json(
        {
          message: errorPayload.message ?? errorPayload.details ?? "Unable to update vendor.",
          details: errorPayload.details,
          hint: errorPayload.hint,
          code: errorPayload.code,
        },
        { status: response.status }
      );
    }

    const [vendor] = payload as Array<{ id: string; name: string }>;
    if (!vendor) {
      return NextResponse.json({ message: "Vendor record not found." }, { status: 404 });
    }

    return NextResponse.json({ vendor });
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
      return NextResponse.json({ message: "Vendor id is required." }, { status: 400 });
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/vendors?id=eq.${encodeURIComponent(id)}`, {
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
          message: payload.message ?? payload.details ?? "Unable to delete vendor.",
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
