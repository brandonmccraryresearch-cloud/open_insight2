import { NextRequest, NextResponse } from "next/server";
import { hasGeminiKey, generateDebateMessage } from "@/lib/gemini";
import { getDebateById, getAgentById } from "@/lib/queries";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, max } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDebateMessagesNeon, persistDebateMessageNeon } from "@/lib/neonPersistence";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentId } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  const debate = getDebateById(id);
  if (!debate) return NextResponse.json({ error: "Debate not found" }, { status: 404 });

  const agent = getAgentById(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Verify the agent is a debate participant
  if (!debate.participants.includes(agentId)) {
    return NextResponse.json({ error: "Agent is not a participant in this debate" }, { status: 403 });
  }

  const neonHistory = await getDebateMessagesNeon(id);
  const combinedHistory = [
    ...debate.messages.map((m) => ({ agentName: m.agentName, content: m.content })),
    ...neonHistory.map((m) => ({ agentName: m.agent_name, content: m.content })),
  ];
  const previousMessages = Array.from(
    new Map(
      combinedHistory.map((m) => [`${m.agentName}:${m.content}`, m]),
    ).values(),
  ).map((m) => ({
    agentName: m.agentName,
    content: m.content,
  }));

  const orderRow = db
    .select({ maxOrder: max(schema.debateMessages.sortOrder) })
    .from(schema.debateMessages)
    .where(eq(schema.debateMessages.debateId, id))
    .get();
  const nextOrder = (orderRow?.maxOrder ?? 0) + 1;
  const msgId = `msg-${randomUUID()}`;
  const timestamp = new Date().toISOString();

  if (!hasGeminiKey()) {
    const content = `[${agent.name}] This debate position requires further elaboration. I maintain my epistemic stance and challenge the preceding argument on formal grounds.`;
    db.insert(schema.debateMessages).values({
      id: msgId,
      debateId: id,
      agentId,
      agentName: agent.name,
      content,
      timestamp,
      verificationStatus: "unchecked",
      verificationDetails: null,
      upvotes: 0,
      sortOrder: nextOrder,
    }).run();
    void persistDebateMessageNeon({
      id: msgId,
      debateId: id,
      agentId,
      agentName: agent.name,
      content,
      timestamp,
      verificationStatus: "unchecked",
      verificationDetails: null,
      upvotes: 0,
      sortOrder: nextOrder,
    }).catch(() => {
      // Best-effort mirror to Neon; local DB write already succeeded.
    });
    return NextResponse.json({
      id: msgId,
      content,
      verificationDetails: undefined,
      agentName: agent.name,
      agentId,
      executionMode: "simulated",
    });
  }

  try {
    const result = await generateDebateMessage(agentId, debate.title, previousMessages);

    // Persist the new message
    db.insert(schema.debateMessages).values({
      id: msgId,
      debateId: id,
      agentId,
      agentName: agent.name,
      content: result.content,
      timestamp,
      verificationStatus: "unchecked",
      verificationDetails: result.verificationDetails ?? null,
      upvotes: 0,
      sortOrder: nextOrder,
    }).run();
    void persistDebateMessageNeon({
      id: msgId,
      debateId: id,
      agentId,
      agentName: agent.name,
      content: result.content,
      timestamp,
      verificationStatus: "unchecked",
      verificationDetails: result.verificationDetails ?? null,
      upvotes: 0,
      sortOrder: nextOrder,
    }).catch(() => {
      // Best-effort mirror to Neon; local DB write already succeeded.
    });

    return NextResponse.json({
      ...result,
      id: msgId,
      agentName: agent.name,
      agentId,
      executionMode: "gemini",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
