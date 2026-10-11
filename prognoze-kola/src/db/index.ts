import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { requireEnv } from "@/lib/env";

let instance: NeonHttpDatabase<typeof schema> | undefined;

/** Lijena inicijalizacija – build ne treba DATABASE_URL. */
export function db(): NeonHttpDatabase<typeof schema> {
  if (!instance) {
    instance = drizzle(neon(requireEnv("DATABASE_URL")), { schema });
  }
  return instance;
}

export { schema };
