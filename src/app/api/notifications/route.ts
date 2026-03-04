import { NextResponse } from "next/server";
import { getHeaderData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const data = getHeaderData();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message, liveDebates: 0, notifications: [] }, { status: 500 });
  }
}
