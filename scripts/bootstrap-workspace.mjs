import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run db:bootstrap -- reviewer@example.go.id");
  process.exit(1);
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!rawUrl || !secretKey?.startsWith("sb_secret_")) {
  console.error("Supabase server configuration is incomplete.");
  process.exit(1);
}
const url = new URL(rawUrl).origin;

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw usersError;
const authUser = users.users.find((user) => user.email?.toLowerCase() === email);
if (!authUser?.email) {
  console.error("Invite or create this Auth user in Supabase before bootstrapping the workspace.");
  process.exit(1);
}

async function ensureRecord(table, column, value, create, update) {
  const { data: existing, error: lookupError } = await supabase
    .from(table)
    .select("id")
    .eq(column, value)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const query = existing
    ? supabase.from(table).update(update).eq("id", existing.id)
    : supabase.from(table).insert(create);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data;
}

const now = new Date().toISOString();
const organization = await ensureRecord(
  "Organization",
  "slug",
  "saring-primary",
  {
    id: randomUUID(),
    slug: "saring-primary",
    displayName: "SARING Primary Workspace",
    updatedAt: now,
  },
  { displayName: "SARING Primary Workspace", updatedAt: now },
);

const profile = await ensureRecord(
  "UserProfile",
  "authUserId",
  authUser.id,
  {
      id: randomUUID(),
      authUserId: authUser.id,
      email: authUser.email,
      displayName: authUser.user_metadata?.display_name ?? authUser.email.split("@")[0],
      isActive: true,
      updatedAt: now,
    },
  {
    email: authUser.email,
    displayName: authUser.user_metadata?.display_name ?? authUser.email.split("@")[0],
    isActive: true,
    updatedAt: now,
  },
);

const { error: membershipError } = await supabase
  .from("OrganizationMembership")
  .upsert(
    { organizationId: organization.id, userId: profile.id, role: "ADMIN" },
    { onConflict: "organizationId,userId" },
  );
if (membershipError) throw membershipError;

console.log("Workspace bootstrap complete for the invited administrator.");
