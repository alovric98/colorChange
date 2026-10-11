import { after, NextResponse } from "next/server";
import { z } from "zod";
import { isCronAuthorized } from "@/lib/auth";
import { runJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Interni endpoint: nastavlja pozadinski posao u novoj invokaciji. */
export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ analysisId: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const origin = new URL(req.url).origin;
  after(() => runJob(body.data.analysisId, origin));
  return NextResponse.json({ accepted: true }, { status: 202 });
}
