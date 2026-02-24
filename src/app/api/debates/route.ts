import { NextRequest, NextResponse } from "next/server";
import { getDebates } from "@/lib/queries";

export function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const debates = getDebates(status);
  return NextResponse.json({ debates });
}
