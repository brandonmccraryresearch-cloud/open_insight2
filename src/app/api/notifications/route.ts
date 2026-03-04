import { NextResponse } from "next/server";
import { getHeaderData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export function GET() {
  const data = getHeaderData();
  return NextResponse.json(data);
}
