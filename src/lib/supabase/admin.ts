import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/env";

let adminClient: ReturnType<typeof createClient> | undefined;

export function createSupabaseAdminClient() {
  if (adminClient) return adminClient;
  const { url, secretKey } = getSupabaseAdminConfig();
  adminClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
