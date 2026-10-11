import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  // Hash izjednačava duljine, pa usporedba ne otkriva duljinu tajne.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Cron i interni pozivi: "Authorization: Bearer <CRON_SECRET>". */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}

/** Gumbi za analizu: lozinka u zaglavlju "x-app-password". */
export function isPasswordAuthorized(req: Request): boolean {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  return safeEqual(req.headers.get("x-app-password") ?? "", password);
}
