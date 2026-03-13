import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { persistForumThreadNeon } from "@/lib/neonPersistence";

export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return params.then(async ({ slug }) => {
    const body = await request.json();
    const { title, authorId, author, tags, excerpt } = body;

    if (!title || !authorId || !author) {
      return NextResponse.json({ error: "title, authorId, and author are required" }, { status: 400 });
    }

    const id = `thread-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const serializedTags = JSON.stringify(tags ?? []);
    db.insert(schema.forumThreads).values({
      id,
      forumSlug: slug,
      title,
      author,
      authorId,
      timestamp,
      replyCount: 0,
      verificationStatus: "unverified",
      tags: serializedTags,
      excerpt: excerpt ?? "",
      upvotes: 0,
      views: 0,
    }).run();
    void persistForumThreadNeon({
      id,
      forumSlug: slug,
      title,
      author,
      authorId,
      timestamp,
      verificationStatus: "unverified",
      tags: serializedTags,
      excerpt: excerpt ?? "",
      upvotes: 0,
      views: 0,
    }).catch(() => {
      // Best-effort mirror to Neon; local DB write already succeeded.
    });

    return NextResponse.json({ thread: { id, title, author, authorId } }, { status: 201 });
  });
}
