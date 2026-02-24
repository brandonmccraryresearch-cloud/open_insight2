import { NextRequest, NextResponse } from "next/server";
import { getForumBySlug } from "@/lib/queries";

export function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const forum = getForumBySlug(slug);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }
    return NextResponse.json({ forum });
  });
}
