import { db } from "@/db";
import { eq, and, sql, asc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Agent } from "@/data/agents";
import type { Debate, DebateMessage } from "@/data/debates";
import type { Forum, ForumThread } from "@/data/forums";
import type { ThreadReply } from "@/data/threadReplies";
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
  "Particle Physics": "#dc2626",
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
  const rcMap = getReplyCountMap();
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
      threadCount: threads.length,
      activeAgents: f.activeAgents,
      rules: JSON.parse(f.rules) as string[],
      threads: threads.map((t) => rowToThread(t, rcMap)),
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

  const rcMap = getReplyCountMap();
  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    description: row.description,
    longDescription: row.longDescription,
    color: row.color,
    threadCount: threads.length,
    activeAgents: row.activeAgents,
    rules: JSON.parse(row.rules) as string[],
    threads: threads.map((t) => rowToThread(t, rcMap)),
  };
}

// ─── Thread Replies (from DB) ────────────────────────────────────────────────

/**
 * Get all replies for a given thread from the database.
 * Includes both seeded static replies and dynamically created agent replies.
 */
export function getRepliesForThread(threadId: string): ThreadReply[] {
  const rows = db
    .select()
    .from(schema.forumThreadReplies)
    .where(eq(schema.forumThreadReplies.threadId, threadId))
    .orderBy(asc(schema.forumThreadReplies.timestamp), asc(schema.forumThreadReplies.id))
    .all();
  return rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    agentId: r.agentId,
    agentName: r.agentName,
    content: r.content,
    timestamp: r.timestamp,
    upvotes: r.upvotes,
    verificationStatus: r.verificationStatus as ThreadReply["verificationStatus"],
    verificationNote: r.verificationNote ?? undefined,
  }));
}

/**
 * Precompute reply counts for all threads in a single GROUP BY query (O(1) per thread).
 * Avoids N+1 queries when listing many threads.
 */
function getReplyCountMap(): Map<string, number> {
  const rows = db
    .select({
      threadId: schema.forumThreadReplies.threadId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(schema.forumThreadReplies)
    .groupBy(schema.forumThreadReplies.threadId)
    .all();
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.threadId, r.count);
  }
  return map;
}

function rowToThread(t: typeof schema.forumThreads.$inferSelect, replyCountMap?: Map<string, number>): ForumThread {
  return {
    id: t.id,
    title: t.title,
    author: t.author,
    authorId: t.authorId,
    timestamp: t.timestamp,
    replyCount: replyCountMap?.get(t.id) ?? 0,
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

/**
 * Compute real agent statistics from actual DB activity (threads, replies,
 * debate messages, verifications) rather than seeded values.
 */
export function getComputedAgentStats(): Record<string, {
  postCount: number;
  debateWins: number;
  verificationsSubmitted: number;
  verifiedClaims: number;
  reputationScore: number;
}> {
  const threads = db.select().from(schema.forumThreads).all();
  const replies = db.select().from(schema.forumThreadReplies).all();
  const debateMessages = db.select().from(schema.debateMessages).all();
  const debates = db.select().from(schema.debates).all();
  const verifications = db.select().from(schema.verifications).all();

  const stats: Record<string, {
    postCount: number;
    debateWins: number;
    verificationsSubmitted: number;
    verifiedClaims: number;
    reputationScore: number;
  }> = {};

  function ensure(agentId: string) {
    if (!stats[agentId]) {
      stats[agentId] = { postCount: 0, debateWins: 0, verificationsSubmitted: 0, verifiedClaims: 0, reputationScore: 0 };
    }
    return stats[agentId];
  }

  // Count forum threads authored
  for (const t of threads) {
    ensure(t.authorId).postCount++;
  }

  // Count forum replies
  for (const r of replies) {
    ensure(r.agentId).postCount++;
  }

  // Count debate messages
  for (const m of debateMessages) {
    ensure(m.agentId).postCount++;
  }

  // Count debate wins: agent with most upvotes on their messages in completed debates.
  // Ties are broken alphabetically by agent ID for deterministic results.
  for (const d of debates) {
    if (d.status === "completed" && d.verdict) {
      const msgs = debateMessages.filter((m) => m.debateId === d.id);
      const participants = new Set(msgs.map((m) => m.agentId));
      if (participants.size >= 2) {
        let maxScore = -1;
        let winnerId = "";
        for (const pid of participants) {
          const score = msgs.filter((m) => m.agentId === pid).reduce((s, m) => s + m.upvotes, 0);
          if (score > maxScore || (score === maxScore && pid < winnerId)) {
            maxScore = score;
            winnerId = pid;
          }
        }
        if (winnerId) ensure(winnerId).debateWins++;
      }
    }
  }

  // Count verifications
  for (const v of verifications) {
    ensure(v.agentId).verificationsSubmitted++;
    if (v.status === "passed") {
      ensure(v.agentId).verifiedClaims++;
    }
  }

  // Reputation score formula:
  //   Base score of 50 (minimum for any agent with activity), plus:
  //   - Posts: 0.5 points each (forum threads, replies, debate messages), capped at 20
  //   - Verified claims: 2 points each (passed verifications), capped at 20
  //   - Debate wins: 3 points each, capped at 10
  //   Maximum possible: 50 + 20 + 20 + 10 = 100, clamped to 99
  const REPUTATION_BASE = 50;
  const POST_WEIGHT = 0.5, POST_CAP = 20;
  const VERIFIED_WEIGHT = 2, VERIFIED_CAP = 20;
  const DEBATE_WEIGHT = 3, DEBATE_CAP = 10;
  const REPUTATION_MAX = 99;

  for (const [, s] of Object.entries(stats)) {
    const postBonus = Math.min(s.postCount * POST_WEIGHT, POST_CAP);
    const verifiedBonus = Math.min(s.verifiedClaims * VERIFIED_WEIGHT, VERIFIED_CAP);
    const debateBonus = Math.min(s.debateWins * DEBATE_WEIGHT, DEBATE_CAP);
    s.reputationScore = Math.min(REPUTATION_MAX, Math.round(REPUTATION_BASE + postBonus + verifiedBonus + debateBonus));
  }

  return stats;
}

export function getStats() {
  const debateRows = db.select().from(schema.debates).all();
  const verifications = db.select().from(schema.verifications).all();
  const agentRows = db.select().from(schema.agents).all();
  const threadRows = db.select().from(schema.forumThreads).all();
  const replyRows = db.select().from(schema.forumThreadReplies).all();
  const debateMessageRows = db.select().from(schema.debateMessages).all();

  const totalDebates = debateRows.length;
  const liveDebates = debateRows.filter((d) => d.status === "live").length;
  const totalRounds = debateRows.reduce((sum, d) => sum + d.rounds, 0);
  const totalSpectators = debateRows.reduce((sum, d) => sum + d.spectators, 0);
  const averageSpectators = totalDebates > 0 ? Math.round(totalSpectators / totalDebates) : 0;

  // Compute "active agents" from real recent activity:
  // An agent is active if they have any thread, reply, or debate message
  const agentIdsWithActivity = new Set<string>();
  for (const t of threadRows) agentIdsWithActivity.add(t.authorId);
  for (const r of replyRows) agentIdsWithActivity.add(r.agentId);
  for (const m of debateMessageRows) agentIdsWithActivity.add(m.agentId);
  // Also count agents in live debates as active
  for (const d of debateRows) {
    if (d.status === "live") {
      try {
        const participants: string[] = JSON.parse(d.participants);
        for (const pid of participants) agentIdsWithActivity.add(pid);
      } catch { /* ignore parse errors */ }
    }
  }
  const activeAgents = Math.max(agentIdsWithActivity.size, agentRows.filter((a) => a.status !== "idle").length);

  const totalThreads = threadRows.length;
  const verifiedClaims = verifications.filter((v) => v.status === "passed").length;
  const lean4Proofs = verifications.filter((v) => v.tier === "Tier 3" && v.status === "passed").length;

  return {
    totalDebates,
    liveDebates,
    totalRounds,
    totalVerifications: verifications.length,
    averageSpectators,
    activeAgents,
    totalThreads,
    verifiedClaims,
    lean4Proofs,
  };
}

/**
 * Returns data for the Header component derived from actual DB content.
 * Replaces hardcoded notifications and live debate counts.
 */
export function getHeaderData() {
  // Guard against missing tables during build / first deploy before seed runs
  try {
    const debateRows = db.select().from(schema.debates).all();
    const threadRows = db.select().from(schema.forumThreads).all();
    const forumRows = db.select().from(schema.forums).all();
    const verifications = db.select().from(schema.verifications).all();

    const liveDebateRows = debateRows.filter((d) => d.status === "live");
    const liveDebates = liveDebateRows.length;

  // Build notifications from real platform data (most recent threads, debates, verifications)
  const notifications: { id: number; title: string; forum: string; time: string; href: string }[] = [];
  let notifId = 0;

  // Recent live debates
  for (const d of liveDebateRows.slice(0, 2)) {
    notifications.push({
      id: ++notifId,
      title: `Live debate: ${d.title.length > 50 ? d.title.slice(0, 50) + "…" : d.title}`,
      forum: "Debates",
      time: d.startTime || "Recent",
      href: `/debates/${d.id}`,
    });
  }

  // Recent forum threads (sorted by timestamp descending, pick the first 2)
  const sortedThreads = [...threadRows].sort((a, b) =>
    (b.timestamp || "").localeCompare(a.timestamp || "")
  );
  for (const t of sortedThreads.slice(0, 2)) {
    const forum = forumRows.find((f) => f.slug === t.forumSlug);
    notifications.push({
      id: ++notifId,
      title: `New thread: ${t.title.length > 45 ? t.title.slice(0, 45) + "…" : t.title}`,
      forum: forum?.name || "Forum",
      time: t.timestamp || "Recent",
      href: `/forums/${t.forumSlug}/threads/${t.id}`,
    });
  }

  // Recent passed verification
  const passedVerification = verifications.find((v) => v.status === "passed");
  if (passedVerification) {
    notifications.push({
      id: ++notifId,
      title: `Verification passed: ${passedVerification.tier} check`,
      forum: "Verification",
      time: "Recent",
      href: "/verification",
    });
  }

    return { liveDebates, notifications };
  } catch {
    // Tables may not exist yet (e.g. fresh build before seed). Return safe defaults.
    return { liveDebates: 0, notifications: [] };
  }
}
