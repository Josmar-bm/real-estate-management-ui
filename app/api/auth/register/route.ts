import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name || !email || !password) {
    return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        full_name: name,
      },
    },
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: error.status ?? 400 });
  }

  return NextResponse.json(
    {
      user: data.user,
      session: data.session,
    },
    { status: 201 }
  );
}
