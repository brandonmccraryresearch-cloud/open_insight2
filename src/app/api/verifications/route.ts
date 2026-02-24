import { NextRequest, NextResponse } from "next/server";
import { getVerifications } from "@/lib/queries";
import { db } from "@/db";
import * as schema from "@/db/schema";

export function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get("tier") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const verifications = getVerifications(tier, status);
  return NextResponse.json({ verifications });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { claim, tier, tool, agentId } = body;

  if (!claim || !tier || !tool || !agentId) {
    return NextResponse.json({ error: "claim, tier, tool, and agentId are required" }, { status: 400 });
  }

  const id = `v-${crypto.randomUUID()}`;
  db.insert(schema.verifications).values({
    id,
    claim,
    tier,
    tool,
    status: "queued",
    agentId,
    timestamp: new Date().toISOString(),
    details: "Awaiting verification...",
    duration: "pending",
    confidence: null,
  }).run();

  return NextResponse.json({ verification: { id, claim, tier, status: "queued" } }, { status: 201 });
}
