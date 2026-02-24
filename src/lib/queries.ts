import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Agent } from "@/data/agents";
import type { Debate, DebateMessage } from "@/data/debates";
import type { Forum, ForumThread } from "@/data/forums";
import type { VerificationEntry } from "@/data/verifications";

// --- Helpers ---

function parseJsonArrays<T extends Record<string, unknown>>(
  row: T,
  keys: (keyof T)[]
): T {
  const result = { ...row };
  for (const key of keys) {
    if (typeof result[key] === "string") {
      try {
        (result as Record<string, unknown>)[key as string] = JSON.parse(result[key] as string);
      } catch {
        // leave as-is
      }
    }
  }
  return result;
}

function rowToAgent(row: typeof schema.agents.$inferSelect): Agent {
  return parseJsonArrays(
    {
      id: row.id,
      name: row.name,
      title: row.title,
      domain: row.domain,
      subfield: row.subfield,
      avatar: row.avatar,
      color: row.color,
      epistemicStance: row.epistemicStance,
      verificationStandard: row.verificationStandard,
      falsifiabilityThreshold: row.falsifiabilityThreshold,
      ontologicalCommitment: row.ontologicalCommitment,
      methodologicalPriors: row.methodologicalPriors as unknown as string[],
      formalisms: row.formalisms as unknown as string[],
      energyScale: row.energyScale,
      approach: row.approach,
      polarPartner: row.polarPartner,
      bio: row.bio,
      postCount: row.postCount,
      debateWins: row.debateWins,
      verificationsSubmitted: row.verificationsSubmitted,
      verifiedClaims: row.verifiedClaims,
      reputationScore: row.reputationScore,
      status: row.status as Agent["status"],
      recentActivity: row.recentActivity,
      keyPublications: row.keyPublications as unknown as string[],
    },
    ["methodologicalPriors", "formalisms", "keyPublications"]
  );
}

// --- Agents ---

export function getAgents(domain?: string): Agent[] {
  let rows;
  if (domain) {
    rows = db.select().from(schema.agents).where(eq(schema.agents.domain, domain)).all();
  } else {
    rows = db.select().from(schema.agents).all();
  }
  return rows.map(rowToAgent);
}

export function getAgentById(id: string): Agent | undefined {
  const row = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
  return row ? rowToAgent(row) : undefined;
}

// --- Polar Pairs ---

export function getPolarPairs() {
  const rows = db.select().from(schema.polarPairs).all();
  return rows.map((r) => ({
    domain: r.domain,
    agents: [r.agent1Id, r.agent2Id],
    tension: r.tension,
  }));
}

// --- Domain Colors (static — no DB needed) ---

export const domainColors: Record<string, string> = {
  "Quantum Foundations": "#6366f1",
  "Quantum Field Theory": "#14b8a6",
  "Quantum Gravity": "#10b981",
  "Foundations of Mathematics": "#f59e0b",
  "Philosophy of Mind": "#ec4899",
};

// --- Debates ---

export function getDebates(status?: string) {
  let rows;
  if (status) {
    rows = db.select().from(schema.debates).where(eq(schema.debates.status, status)).all();
  } else {
    rows = db.select().from(schema.debates).all();
  }
  const allMessages = db.select().from(schema.debateMessages).all();
  const msgCountMap = new Map<string, number>();
  for (const msg of allMessages) {
    msgCountMap.set(msg.debateId, (msgCountMap.get(msg.debateId) || 0) + 1);
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    domain: r.domain,
    status: r.status as Debate["status"],
    format: r.format as Debate["format"],
    participants: JSON.parse(r.participants) as string[],
    startTime: r.startTime,
    rounds: r.rounds,
    currentRound: r.currentRound,
    spectators: r.spectators,
    summary: r.summary,
    verdict: r.verdict ?? undefined,
    tags: JSON.parse(r.tags) as string[],
    messageCount: msgCountMap.get(r.id) || 0,
  }));
}

export function getDebateById(id: string): Debate | undefined {
  const row = db.select().from(schema.debates).where(eq(schema.debates.id, id)).get();
  if (!row) return undefined;

  const messages = db
    .select()
    .from(schema.debateMessages)
    .where(eq(schema.debateMessages.debateId, id))
    .orderBy(schema.debateMessages.sortOrder)
    .all();

  return {
    id: row.id,
    title: row.title,
    domain: row.domain,
    status: row.status as Debate["status"],
    format: row.format as Debate["format"],
    participants: JSON.parse(row.participants) as string[],
    startTime: row.startTime,
    rounds: row.rounds,
    currentRound: row.currentRound,
    spectators: row.spectators,
    summary: row.summary,
    verdict: row.verdict ?? undefined,
    messages: messages.map((m) => ({
      id: m.id,
      agentId: m.agentId,
      agentName: m.agentName,
      content: m.content,
      timestamp: m.timestamp,
      verificationStatus: m.verificationStatus as DebateMessage["verificationStatus"],
      verificationDetails: m.verificationDetails ?? undefined,
      upvotes: m.upvotes,
    })),
    tags: JSON.parse(row.tags) as string[],
  };
}

// --- Forums ---

export function getForums(): Forum[] {
  const forumRows = db.select().from(schema.forums).all();
  return forumRows.map((f) => {
    const threads = db
      .select()
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.forumSlug, f.slug))
      .all();

    return {
      slug: f.slug,
      name: f.name,
      icon: f.icon,
      description: f.description,
      longDescription: f.longDescription,
      color: f.color,
      threadCount: f.threadCount,
      activeAgents: f.activeAgents,
      rules: JSON.parse(f.rules) as string[],
      threads: threads.map(rowToThread),
    };
  });
}

export function getForumBySlug(slug: string): Forum | undefined {
  const row = db.select().from(schema.forums).where(eq(schema.forums.slug, slug)).get();
  if (!row) return undefined;

  const threads = db
    .select()
    .from(schema.forumThreads)
    .where(eq(schema.forumThreads.forumSlug, slug))
    .all();

  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    description: row.description,
    longDescription: row.longDescription,
    color: row.color,
    threadCount: row.threadCount,
    activeAgents: row.activeAgents,
    rules: JSON.parse(row.rules) as string[],
    threads: threads.map(rowToThread),
  };
}

function rowToThread(t: typeof schema.forumThreads.$inferSelect): ForumThread {
  return {
    id: t.id,
    title: t.title,
    author: t.author,
    authorId: t.authorId,
    timestamp: t.timestamp,
    replyCount: t.replyCount,
    verificationStatus: t.verificationStatus as ForumThread["verificationStatus"],
    tags: JSON.parse(t.tags) as string[],
    excerpt: t.excerpt,
    upvotes: t.upvotes,
    views: t.views,
  };
}

// --- Verifications ---

export function getVerifications(tier?: string, status?: string): VerificationEntry[] {
  let rows;
  if (tier && status) {
    rows = db.select().from(schema.verifications)
      .where(and(eq(schema.verifications.tier, tier), eq(schema.verifications.status, status)))
      .all();
  } else if (tier) {
    rows = db.select().from(schema.verifications).where(eq(schema.verifications.tier, tier)).all();
  } else if (status) {
    rows = db.select().from(schema.verifications).where(eq(schema.verifications.status, status)).all();
  } else {
    rows = db.select().from(schema.verifications).all();
  }
  return rows.map((r) => ({
    id: r.id,
    claim: r.claim,
    tier: r.tier as VerificationEntry["tier"],
    tool: r.tool,
    status: r.status as VerificationEntry["status"],
    agentId: r.agentId,
    timestamp: r.timestamp,
    details: r.details,
    duration: r.duration,
    confidence: r.confidence ?? undefined,
  }));
}

// --- Stats ---

export function getStats() {
  const debateRows = db.select().from(schema.debates).all();
  const verificationCount = db.select().from(schema.verifications).all().length;

  const totalDebates = debateRows.length;
  const liveDebates = debateRows.filter((d) => d.status === "live").length;
  const totalRounds = debateRows.reduce((sum, d) => sum + d.rounds, 0);
  const totalSpectators = debateRows.reduce((sum, d) => sum + d.spectators, 0);
  const averageSpectators = totalDebates > 0 ? Math.round(totalSpectators / totalDebates) : 0;

  return {
    totalDebates,
    liveDebates,
    totalRounds,
    totalVerifications: verificationCount,
    averageSpectators,
  };
}
