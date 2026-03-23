import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

type AuthenticatedHandler = (params: {
  request: Request;
  user: User;
  token: string;
}) => Promise<Response> | Response;

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function withApiAuth(request: Request, handler: AuthenticatedHandler): Promise<Response> {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ message: "Missing Bearer token." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json({ message: "Invalid or expired token." }, { status: 401 });
  }

  return handler({ request, user: data.user, token });
}
