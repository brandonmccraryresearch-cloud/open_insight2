import { NextRequest, NextResponse } from "next/server";
import { getAgents } from "@/lib/queries";

export function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain") ?? undefined;
  const agents = getAgents(domain);
  return NextResponse.json({ agents });
}
