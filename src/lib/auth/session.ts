import "server-only";

import { redirect } from "next/navigation";
import { getSupabasePublicConfig, isLocalDemoAuthEnabled } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceSession = {
  authUserId: string;
  email: string;
  displayName: string;
  mode: "supabase" | "local-demo";
};

export async function getWorkspaceSession(): Promise<WorkspaceSession | null> {
  if (isLocalDemoAuthEnabled()) {
    return {
      authUserId: "00000000-0000-4000-8000-000000000001",
      email: "demo@saring.local",
      displayName: "Demo Reviewer",
      mode: "local-demo",
    };
  }

  if (!getSupabasePublicConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "authenticated";
  const userMetadata = data.claims.user_metadata;
  const displayName =
    userMetadata &&
    typeof userMetadata === "object" &&
    "display_name" in userMetadata &&
    typeof userMetadata.display_name === "string"
      ? userMetadata.display_name
      : email.split("@")[0];

  return {
    authUserId: data.claims.sub,
    email,
    displayName,
    mode: "supabase",
  };
}

export async function requireWorkspaceSession() {
  const session = await getWorkspaceSession();
  if (!session) redirect("/login");
  return session;
}
