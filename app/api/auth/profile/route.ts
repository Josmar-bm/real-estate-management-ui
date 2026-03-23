import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

type ProfileBody = {
  displayName?: unknown;
  phone?: unknown;
};

function normalizePhoneToE164(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return "";
  }

  // Keep only digits and an optional leading plus.
  let normalized = trimmed.replace(/[^\d+]/g, "");

  // Convert international prefix 00 to + (e.g. 0044... -> +44...).
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  // Convenience handling for common US inputs without country code.
  if (!normalized.startsWith("+")) {
    const digitsOnly = normalized.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      normalized = `+1${digitsOnly}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      normalized = `+${digitsOnly}`;
    } else {
      return null;
    }
  }

  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export async function PATCH(request: Request) {
  return withApiAuth(request, async ({ user, token }) => {
    let body: ProfileBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const displayName = String(body.displayName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const normalizedPhone = normalizePhoneToE164(phone);

    if (!displayName) {
      return NextResponse.json({ message: "Display name is required." }, { status: 400 });
    }

    if (normalizedPhone === null) {
      return NextResponse.json(
        { message: "Phone must be valid E.164 (example: +15551234567)." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: "Supabase environment is not configured." }, { status: 500 });
    }

    const metadata = {
      ...(user.user_metadata ?? {}),
      display_name: displayName,
      full_name: displayName,
      phone: normalizedPhone,
    };

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: metadata,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      msg?: string;
      message?: string;
      user_metadata?: { display_name?: string; full_name?: string; phone?: string };
      email?: string;
    };

    if (!response.ok) {
      return NextResponse.json(
        { message: payload.msg ?? payload.message ?? "Unable to update profile." },
        { status: response.status }
      );
    }

    const updatedMetadata = payload.user_metadata ?? {};

    return NextResponse.json({
      user: {
        email: payload.email ?? user.email,
        displayName: updatedMetadata.display_name ?? updatedMetadata.full_name ?? displayName,
        phone: updatedMetadata.phone ?? normalizedPhone,
      },
    });
  });
}
