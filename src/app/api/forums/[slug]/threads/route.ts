import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";

export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return params.then(async ({ slug }) => {
    const body = await request.json();
    const { title, authorId, author, tags, excerpt } = body;

    if (!title || !authorId || !author) {
      return NextResponse.json({ error: "title, authorId, and author are required" }, { status: 400 });
    }

    const id = `thread-${crypto.randomUUID()}`;
    db.insert(schema.forumThreads).values({
      id,
      forumSlug: slug,
      title,
      author,
      authorId,
      timestamp: new Date().toISOString(),
      replyCount: 0,
      verificationStatus: "unverified",
      tags: JSON.stringify(tags ?? []),
      excerpt: excerpt ?? "",
      upvotes: 0,
      views: 0,
    }).run();

    return NextResponse.json({ thread: { id, title, author, authorId } }, { status: 201 });
  });
}
