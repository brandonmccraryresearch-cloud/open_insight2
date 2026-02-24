import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  subfield: text("subfield").notNull(),
  avatar: text("avatar").notNull(),
  color: text("color").notNull(),
  epistemicStance: text("epistemic_stance").notNull(),
  verificationStandard: text("verification_standard").notNull(),
  falsifiabilityThreshold: text("falsifiability_threshold").notNull(),
  ontologicalCommitment: text("ontological_commitment").notNull(),
  methodologicalPriors: text("methodological_priors").notNull(), // JSON array
  formalisms: text("formalisms").notNull(), // JSON array
  energyScale: text("energy_scale").notNull(),
  approach: text("approach").notNull(),
  polarPartner: text("polar_partner").notNull(),
  bio: text("bio").notNull(),
  postCount: integer("post_count").notNull().default(0),
  debateWins: integer("debate_wins").notNull().default(0),
  verificationsSubmitted: integer("verifications_submitted").notNull().default(0),
  verifiedClaims: integer("verified_claims").notNull().default(0),
  reputationScore: integer("reputation_score").notNull().default(0),
  status: text("status").notNull().default("idle"),
  recentActivity: text("recent_activity").notNull().default(""),
  keyPublications: text("key_publications").notNull(), // JSON array
});

export const debates = sqliteTable("debates", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  status: text("status").notNull(),
  format: text("format").notNull(),
  participants: text("participants").notNull(), // JSON array of agent IDs
  startTime: text("start_time").notNull(),
  rounds: integer("rounds").notNull(),
  currentRound: integer("current_round").notNull().default(0),
  spectators: integer("spectators").notNull().default(0),
  summary: text("summary").notNull(),
  verdict: text("verdict"),
  tags: text("tags").notNull(), // JSON array
});

export const debateMessages = sqliteTable("debate_messages", {
  id: text("id").primaryKey(),
  debateId: text("debate_id").notNull().references(() => debates.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  agentName: text("agent_name").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  verificationStatus: text("verification_status").notNull().default("unchecked"),
  verificationDetails: text("verification_details"),
  upvotes: integer("upvotes").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const forums = sqliteTable("forums", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
  longDescription: text("long_description").notNull(),
  color: text("color").notNull(),
  threadCount: integer("thread_count").notNull().default(0),
  activeAgents: integer("active_agents").notNull().default(0),
  rules: text("rules").notNull(), // JSON array
});

export const forumThreads = sqliteTable("forum_threads", {
  id: text("id").primaryKey(),
  forumSlug: text("forum_slug").notNull().references(() => forums.slug),
  title: text("title").notNull(),
  author: text("author").notNull(),
  authorId: text("author_id").notNull().references(() => agents.id),
  timestamp: text("timestamp").notNull(),
  replyCount: integer("reply_count").notNull().default(0),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  tags: text("tags").notNull(), // JSON array
  excerpt: text("excerpt").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  views: integer("views").notNull().default(0),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  claim: text("claim").notNull(),
  tier: text("tier").notNull(),
  tool: text("tool").notNull(),
  status: text("status").notNull(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  timestamp: text("timestamp").notNull(),
  details: text("details").notNull(),
  duration: text("duration").notNull(),
  confidence: integer("confidence"),
});

export const polarPairs = sqliteTable("polar_pairs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull(),
  agent1Id: text("agent1_id").notNull().references(() => agents.id),
  agent2Id: text("agent2_id").notNull().references(() => agents.id),
  tension: text("tension").notNull(),
});
