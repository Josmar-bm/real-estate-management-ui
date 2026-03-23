import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  return withApiAuth(request, async ({ user }) => {
    const metadata = (user.user_metadata ?? {}) as {
      display_name?: string;
      full_name?: string;
      phone?: string;
    };

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: metadata.display_name ?? metadata.full_name ?? null,
        phone: metadata.phone ?? null,
      },
    });
  });
}
