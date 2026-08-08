import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getWorkspaceSession } from "@/lib/auth/session";
import { getSupabasePublicConfig, isLocalDemoAuthEnabled } from "@/lib/env";
import { SaringMark } from "@/components/saring-mark";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const messages: Record<string, string> = {
  invalid_input: "Check your email and password format.",
  invalid_credentials: "Email or password is incorrect.",
  invalid_link: "The authentication link is invalid or expired.",
  not_configured: "Authentication has not been configured yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getWorkspaceSession();
  if (session) redirect("/dashboard");

  const params = await searchParams;
  const errorMessage = params.error ? messages[params.error] : null;
  const configured = Boolean(getSupabasePublicConfig());
  const demoEnabled = isLocalDemoAuthEnabled();

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 py-12 text-[#0b1b43]">
      <section className="w-full max-w-[420px]" aria-labelledby="sign-in-title">
        <div className="flex justify-center">
          <div className="flex items-center gap-2.5">
            <SaringMark className="size-10 text-[#0b1b43]" />
            <span className="text-base font-extrabold tracking-[-0.02em]">SARING</span>
          </div>
        </div>

        <div className="mb-9 mt-10 text-center">
          <h1 id="sign-in-title" className="text-[28px] font-extrabold tracking-[-0.025em] text-[#17191d]">Sign in to workspace</h1>
          <p className="mx-auto mt-3 max-w-[38ch] text-sm font-medium leading-6 text-[#647493]">Invitation-only access to procurement evidence and review workflows.</p>
        </div>

        {errorMessage ? <p role="alert" className="mb-5 rounded-lg border border-[#edb8b3] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#a9342c]">{errorMessage}</p> : null}
        {!configured && !demoEnabled ? <p className="mb-5 rounded-lg border border-[#e0b254] bg-[#fff9e8] px-4 py-3 text-sm font-semibold leading-5 text-[#73500a]">Authentication is not configured. Add the Supabase variables from <code className="font-mono">.env.example</code>.</p> : null}

        <form action={signIn} className="space-y-5">
          <label className="block text-sm font-bold text-[#2d3f66]">Work email
            <input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="you@organization.go.id" className="mt-2 h-12 w-full rounded-lg border border-[#b8bbc2] bg-white px-4 text-base font-medium text-[#17191d] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#8a98b0] focus:border-[#1450e6] focus:ring-2 focus:ring-[#1450e6]/15" />
          </label>
          <label className="block text-sm font-bold text-[#2d3f66]">Password
            <input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={256} placeholder="Enter your password" className="mt-2 h-12 w-full rounded-lg border border-[#b8bbc2] bg-white px-4 text-base font-medium text-[#17191d] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#8a98b0] focus:border-[#1450e6] focus:ring-2 focus:ring-[#1450e6]/15" />
          </label>
          <button type="submit" disabled={!configured} className="h-12 w-full rounded-lg border border-[#a9d500] bg-[#c7ff00] px-5 text-base font-extrabold text-[#0b1b43] transition-colors duration-200 hover:bg-[#b9ee00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1450e6] disabled:cursor-not-allowed disabled:border-[#d7d9dd] disabled:bg-[#eef0f3] disabled:text-[#77869f]">Sign in securely</button>
        </form>

        <p className="mt-8 flex items-center justify-center gap-2 border-t border-[#e5e6e8] pt-5 text-xs font-semibold text-[#77869f]"><LockKeyhole size={13} aria-hidden="true" /> TLS protected · Audit logged · No public signup</p>
      </section>
    </main>
  );
}
