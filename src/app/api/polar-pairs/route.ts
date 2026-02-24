import { NextResponse } from "next/server";
import { getPolarPairs } from "@/lib/queries";

export function GET() {
  const pairs = getPolarPairs();
  return NextResponse.json({ polarPairs: pairs });
}
