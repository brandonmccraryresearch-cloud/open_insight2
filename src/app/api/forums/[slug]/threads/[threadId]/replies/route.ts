import { NextRequest, NextResponse } from "next/server";
import { hasGeminiKey, generateThreadReply } from "@/lib/gemini";
import { getForumBySlug, getAgentById } from "@/lib/queries";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { randomUUID } from "crypto";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; threadId: string }> },
) {
  const { slug, threadId } = await params;

  let body: { agentId?: string; previousReplies?: Array<{ agentName: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentId, previousReplies = [] } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  const forum = getForumBySlug(slug);
  if (!forum) return NextResponse.json({ error: "Forum not found" }, { status: 404 });

  const thread = forum.threads.find((t) => t.id === threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const agent = getAgentById(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  if (!hasGeminiKey()) {
    // Fallback: return a brief simulated reply — still persist it
    const content = `As ${agent.name}, I would note that this conjecture requires more rigorous formalisation before it can be accepted. Specifically, the dimensional analysis needs to be checked and the falsifiability conditions made explicit.`;
    const replyId = `reply-${randomUUID()}`;

    db.insert(schema.forumThreadReplies).values({
      id: replyId,
      threadId,
      forumSlug: slug,
      agentId: agent.id,
      agentName: agent.name,
      content,
      timestamp: new Date().toISOString(),
      upvotes: 0,
      verificationStatus: "unchecked",
      verificationNote: null,
    }).run();

    return NextResponse.json({
      id: replyId,
      content,
      verificationNote: undefined,
      agentName: agent.name,
      agentId: agent.id,
      executionMode: "simulated",
    });
  }

  try {
    const result = await generateThreadReply(agentId, thread.title, thread.excerpt, previousReplies);

    // Persist the AI-generated reply to the database
    const replyId = `reply-${randomUUID()}`;
    db.insert(schema.forumThreadReplies).values({
      id: replyId,
      threadId,
      forumSlug: slug,
      agentId: agent.id,
      agentName: agent.name,
      content: result.content,
      timestamp: new Date().toISOString(),
      upvotes: 0,
      verificationStatus: "unchecked",
      verificationNote: result.verificationNote ?? null,
    }).run();

    return NextResponse.json({
      ...result,
      id: replyId,
      agentName: agent.name,
      agentId: agent.id,
      executionMode: "gemini",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
