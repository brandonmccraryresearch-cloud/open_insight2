import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";

// Import source data
import { agents as agentData, polarPairs as polarPairData } from "../data/agents";
import { debates as debateData } from "../data/debates";
import { forums as forumData } from "../data/forums";
import { verifications as verificationData } from "../data/verifications";

const dbPath = path.join(process.cwd(), "open-insight.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

console.log("Seeding database...");

// Seed agents
for (const agent of agentData) {
  db.insert(schema.agents).values({
    id: agent.id,
    name: agent.name,
    title: agent.title,
    domain: agent.domain,
    subfield: agent.subfield,
    avatar: agent.avatar,
    color: agent.color,
    epistemicStance: agent.epistemicStance,
    verificationStandard: agent.verificationStandard,
    falsifiabilityThreshold: agent.falsifiabilityThreshold,
    ontologicalCommitment: agent.ontologicalCommitment,
    methodologicalPriors: JSON.stringify(agent.methodologicalPriors),
    formalisms: JSON.stringify(agent.formalisms),
    energyScale: agent.energyScale,
    approach: agent.approach,
    polarPartner: agent.polarPartner,
    bio: agent.bio,
    postCount: agent.postCount,
    debateWins: agent.debateWins,
    verificationsSubmitted: agent.verificationsSubmitted,
    verifiedClaims: agent.verifiedClaims,
    reputationScore: agent.reputationScore,
    status: agent.status,
    recentActivity: agent.recentActivity,
    keyPublications: JSON.stringify(agent.keyPublications),
  }).run();
}
console.log(`  Seeded ${agentData.length} agents`);

// Seed polar pairs
for (const pair of polarPairData) {
  db.insert(schema.polarPairs).values({
    domain: pair.domain,
    agent1Id: pair.agents[0],
    agent2Id: pair.agents[1],
    tension: pair.tension,
  }).run();
}
console.log(`  Seeded ${polarPairData.length} polar pairs`);

// Seed debates and messages
let messageCount = 0;
for (const debate of debateData) {
  db.insert(schema.debates).values({
    id: debate.id,
    title: debate.title,
    domain: debate.domain,
    status: debate.status,
    format: debate.format,
    participants: JSON.stringify(debate.participants),
    startTime: debate.startTime,
    rounds: debate.rounds,
    currentRound: debate.currentRound,
    spectators: debate.spectators,
    summary: debate.summary,
    verdict: debate.verdict ?? null,
    tags: JSON.stringify(debate.tags),
  }).run();

  for (let i = 0; i < debate.messages.length; i++) {
    const msg = debate.messages[i];
    db.insert(schema.debateMessages).values({
      id: msg.id,
      debateId: debate.id,
      agentId: msg.agentId,
      agentName: msg.agentName,
      content: msg.content,
      timestamp: msg.timestamp,
      verificationStatus: msg.verificationStatus,
      verificationDetails: msg.verificationDetails ?? null,
      upvotes: msg.upvotes,
      sortOrder: i,
    }).run();
    messageCount++;
  }
}
console.log(`  Seeded ${debateData.length} debates with ${messageCount} messages`);

// Seed forums and threads
let threadCount = 0;
for (const forum of forumData) {
  db.insert(schema.forums).values({
    slug: forum.slug,
    name: forum.name,
    icon: forum.icon,
    description: forum.description,
    longDescription: forum.longDescription,
    color: forum.color,
    threadCount: forum.threadCount,
    activeAgents: forum.activeAgents,
    rules: JSON.stringify(forum.rules),
  }).run();

  for (const thread of forum.threads) {
    db.insert(schema.forumThreads).values({
      id: thread.id,
      forumSlug: forum.slug,
      title: thread.title,
      author: thread.author,
      authorId: thread.authorId,
      timestamp: thread.timestamp,
      replyCount: thread.replyCount,
      verificationStatus: thread.verificationStatus,
      tags: JSON.stringify(thread.tags),
      excerpt: thread.excerpt,
      upvotes: thread.upvotes,
      views: thread.views,
    }).run();
    threadCount++;
  }
}
console.log(`  Seeded ${forumData.length} forums with ${threadCount} threads`);

// Seed verifications
for (const v of verificationData) {
  db.insert(schema.verifications).values({
    id: v.id,
    claim: v.claim,
    tier: v.tier,
    tool: v.tool,
    status: v.status,
    agentId: v.agentId,
    timestamp: v.timestamp,
    details: v.details,
    duration: v.duration,
    confidence: v.confidence ?? null,
  }).run();
}
console.log(`  Seeded ${verificationData.length} verifications`);

console.log("Done!");
sqlite.close();
