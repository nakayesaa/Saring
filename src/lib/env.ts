export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type AnalysisEngineConfig = { driver: "fixture" | "worker" };

export type MalwareScannerConfig =
  | { driver: "synthetic-only" }
  | { driver: "http"; url: URL; token: string };

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

export function isLocalDemoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEMO_BYPASS_AUTH === "true"
  );
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for database access.");
  }
  return value;
}

export function getSupabaseAdminConfig() {
  const publicConfig = getSupabasePublicConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!publicConfig || !secretKey?.startsWith("sb_secret_")) {
    throw new Error("Supabase server configuration is incomplete.");
  }
  return { url: publicConfig.url, secretKey };
}

export function getAnalysisEngineConfig(): AnalysisEngineConfig {
  const driver = process.env.ANALYSIS_ENGINE_DRIVER?.trim() || "fixture";
  if (driver !== "fixture" && driver !== "worker") {
    throw new Error("ANALYSIS_ENGINE_DRIVER must be fixture or worker.");
  }
  return { driver };
}

export function getAnalysisCallbackToken() {
  const token = process.env.ANALYSIS_CALLBACK_TOKEN?.trim();
  const minimumLength = process.env.NODE_ENV === "production" ? 32 : 16;
  return token && token.length >= minimumLength ? token : null;
}

export function getMalwareScannerConfig(): MalwareScannerConfig {
  const driver = process.env.MALWARE_SCANNER_DRIVER?.trim() || "synthetic-only";
  if (driver === "synthetic-only") return { driver };
  if (driver !== "http") throw new Error("MALWARE_SCANNER_DRIVER must be synthetic-only or http.");
  const rawUrl = process.env.MALWARE_SCANNER_URL?.trim();
  const token = process.env.MALWARE_SCANNER_TOKEN?.trim();
  if (!rawUrl || !token || token.length < 32) {
    throw new Error("HTTP malware scanner configuration is incomplete.");
  }
  const url = new URL(rawUrl);
  const localHttp = process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("MALWARE_SCANNER_URL must use HTTPS outside local development.");
  }
  return { driver, url, token };
}
