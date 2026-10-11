type EnvKey = "ANTHROPIC_API_KEY" | "API_FOOTBALL_KEY" | "DATABASE_URL" | "CRON_SECRET" | "APP_PASSWORD";

export function requireEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) throw new Error(`Nedostaje env varijabla ${key}`);
  return value;
}

/** Bazni URL za pozive prema vlastitim API rutama (nastavak pozadinskog posla). */
export function appBaseUrl(fallbackOrigin?: string): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return fallbackOrigin ?? "http://localhost:3000";
}
