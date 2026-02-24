import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";

export function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string; threadId: string }> }) {
  return params.then(({ threadId }) => {
    const thread = db.select().from(schema.forumThreads).where(eq(schema.forumThreads.id, threadId)).get();
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    db.update(schema.forumThreads)
      .set({ upvotes: sql`${schema.forumThreads.upvotes} + 1` })
      .where(eq(schema.forumThreads.id, threadId))
      .run();

    return NextResponse.json({ success: true });
  });
}
