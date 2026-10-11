import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { settleFinishedMatches } from "@/lib/results";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Upisuje stvarne rezultate odigranih utakmica. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await settleFinishedMatches());
  } catch (err) {
    console.error("[cron/results]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
