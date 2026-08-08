import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/env";

export async function refreshSupabaseSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  const config = getSupabasePublicConfig();
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!config) return response;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validates/refreshes the session. Authorization still happens at the page
  // and data-access boundaries; Proxy is never treated as the security gate.
  await supabase.auth.getClaims();
  return response;
}
