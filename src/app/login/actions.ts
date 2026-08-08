"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
});

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid_input");

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect("/login?error=not_configured");
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid_credentials");
  redirect("/dashboard");
}

export async function signOut() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Missing config is equivalent to having no remote session.
  }
  redirect("/login");
}
