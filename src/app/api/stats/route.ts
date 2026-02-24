import { NextResponse } from "next/server";
import { getStats } from "@/lib/queries";

export function GET() {
  return NextResponse.json(getStats());
}
