import { NextResponse } from "next/server";
import { getForums } from "@/lib/queries";

export function GET() {
  const forums = getForums();
  return NextResponse.json({ forums });
}
