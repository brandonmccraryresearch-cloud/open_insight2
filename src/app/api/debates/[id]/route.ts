import { NextRequest, NextResponse } from "next/server";
import { getDebateById } from "@/lib/queries";

export function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const debate = getDebateById(id);
    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }
    return NextResponse.json({ debate });
  });
}
