import { NextRequest, NextResponse } from "next/server";
import { getAgentById, getPolarPairs } from "@/lib/queries";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  let body: {
    agent1Id?: string;
    agent2Id?: string;
    title?: string;
    format?: string;
    summary?: string;
    tags?: string[];
    rounds?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent1Id, title, format = "adversarial", summary, tags = [], rounds = 6 } = body;
  let { agent2Id } = body;

  if (!agent1Id) {
    return NextResponse.json({ error: "agent1Id is required" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const agent1 = getAgentById(agent1Id);
  if (!agent1) {
    return NextResponse.json({ error: `Agent not found: ${agent1Id}` }, { status: 404 });
  }

  // Default to polar partner if agent2 not specified
  if (!agent2Id) {
    if (!agent1.polarPartner) {
      return NextResponse.json({ error: "agent2Id is required (agent1 has no polar partner to default to)" }, { status: 400 });
    }
    agent2Id = agent1.polarPartner;
  }

  const agent2 = getAgentById(agent2Id);
  if (!agent2) {
    return NextResponse.json({ error: `Opponent agent not found: ${agent2Id}` }, { status: 404 });
  }

  if (agent1Id === agent2Id) {
    return NextResponse.json({ error: "An agent cannot debate itself" }, { status: 400 });
  }

  const validFormats = ["adversarial", "collaborative", "socratic"];
  if (!validFormats.includes(format)) {
    return NextResponse.json({ error: `Invalid format. Must be one of: ${validFormats.join(", ")}` }, { status: 400 });
  }

  if (rounds < 1 || rounds > 20) {
    return NextResponse.json({ error: "rounds must be between 1 and 20" }, { status: 400 });
  }

  // Determine domain: use the polar pair domain if available, else agent1's domain
  const polarPairs = getPolarPairs();
  const pair = polarPairs.find(
    (p) => p.agents.includes(agent1Id!) && p.agents.includes(agent2Id!)
  );
  const domain = pair?.domain ?? agent1.domain;

  const debateId = `debate-${randomUUID()}`;
  const debateSummary = summary || `A ${format} debate between ${agent1.name} and ${agent2.name} on ${title}.`;

  db.insert(schema.debates).values({
    id: debateId,
    title: title.trim(),
    domain,
    status: "live",
    format,
    participants: JSON.stringify([agent1Id, agent2Id]),
    startTime: "just now",
    rounds,
    currentRound: 0,
    spectators: 0,
    summary: debateSummary,
    verdict: null,
    tags: JSON.stringify(tags),
  }).run();

  return NextResponse.json({
    id: debateId,
    title: title.trim(),
    domain,
    status: "live",
    format,
    participants: [agent1Id, agent2Id],
    agent1: { id: agent1.id, name: agent1.name, avatar: agent1.avatar, color: agent1.color },
    agent2: { id: agent2.id, name: agent2.name, avatar: agent2.avatar, color: agent2.color },
    rounds,
    summary: debateSummary,
    tension: pair?.tension,
  }, { status: 201 });
}
