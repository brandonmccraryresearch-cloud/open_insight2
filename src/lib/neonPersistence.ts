import { neon } from "@neondatabase/serverless";

type DebateMessageRow = {
  id: string;
  debate_id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  timestamp: string;
  verification_status: string;
  verification_details: string | null;
  upvotes: number;
  sort_order: number;
};

type ThreadReplyRow = {
  id: string;
  thread_id: string;
  forum_slug: string;
  agent_id: string;
  agent_name: string;
  content: string;
  timestamp: string;
  upvotes: number;
  verification_status: string;
  verification_note: string | null;
};

type ForumThreadRow = {
  id: string;
  forum_slug: string;
  title: string;
  author: string;
  author_id: string;
  timestamp: string;
  reply_count: number;
  verification_status: string;
  tags: string;
  excerpt: string;
  upvotes: number;
  views: number;
};

const databaseUrl = process.env.DATABASE_URL;
const neonEnabled =
  typeof databaseUrl === "string" &&
  (databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://"));

const sql = neonEnabled ? neon(databaseUrl!) : null;

let initPromise: Promise<void> | null = null;
async function ensureNeonTables() {
  if (!sql) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS debate_messages_neon (
        id text PRIMARY KEY,
        debate_id text NOT NULL,
        agent_id text NOT NULL,
        agent_name text NOT NULL,
        content text NOT NULL,
        timestamp text NOT NULL,
        verification_status text NOT NULL DEFAULT 'unchecked',
        verification_details text,
        upvotes integer NOT NULL DEFAULT 0,
        sort_order integer NOT NULL DEFAULT 0
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS forum_thread_replies_neon (
        id text PRIMARY KEY,
        thread_id text NOT NULL,
        forum_slug text NOT NULL,
        agent_id text NOT NULL,
        agent_name text NOT NULL,
        content text NOT NULL,
        timestamp text NOT NULL,
        upvotes integer NOT NULL DEFAULT 0,
        verification_status text NOT NULL DEFAULT 'unchecked',
        verification_note text
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS forum_threads_neon (
        id text PRIMARY KEY,
        forum_slug text NOT NULL,
        title text NOT NULL,
        author text NOT NULL,
        author_id text NOT NULL,
        timestamp text NOT NULL,
        reply_count integer NOT NULL DEFAULT 0,
        verification_status text NOT NULL DEFAULT 'unverified',
        tags text NOT NULL,
        excerpt text NOT NULL,
        upvotes integer NOT NULL DEFAULT 0,
        views integer NOT NULL DEFAULT 0
      )
    `;
  })();
  return initPromise;
}

export function isNeonPersistenceEnabled() {
  return neonEnabled;
}

export async function persistDebateMessageNeon(message: {
  id: string;
  debateId: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
  verificationStatus: string;
  verificationDetails: string | null;
  upvotes: number;
  sortOrder: number;
}) {
  if (!sql) return;
  await ensureNeonTables();
  await sql`
    INSERT INTO debate_messages_neon (
      id, debate_id, agent_id, agent_name, content, timestamp,
      verification_status, verification_details, upvotes, sort_order
    ) VALUES (
      ${message.id}, ${message.debateId}, ${message.agentId}, ${message.agentName}, ${message.content}, ${message.timestamp},
      ${message.verificationStatus}, ${message.verificationDetails}, ${message.upvotes}, ${message.sortOrder}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getDebateMessagesNeon(
  debateId: string,
): Promise<DebateMessageRow[]> {
  if (!sql) return [];
  await ensureNeonTables();
  const rows = await sql`
    SELECT * FROM debate_messages_neon
    WHERE debate_id = ${debateId}
    ORDER BY sort_order ASC, id ASC
  `;
  return rows as DebateMessageRow[];
}

export async function persistThreadReplyNeon(reply: {
  id: string;
  threadId: string;
  forumSlug: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
  upvotes: number;
  verificationStatus: string;
  verificationNote: string | null;
}) {
  if (!sql) return;
  await ensureNeonTables();
  await sql`
    INSERT INTO forum_thread_replies_neon (
      id, thread_id, forum_slug, agent_id, agent_name, content, timestamp,
      upvotes, verification_status, verification_note
    ) VALUES (
      ${reply.id}, ${reply.threadId}, ${reply.forumSlug}, ${reply.agentId}, ${reply.agentName}, ${reply.content}, ${reply.timestamp},
      ${reply.upvotes}, ${reply.verificationStatus}, ${reply.verificationNote}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getThreadRepliesNeon(
  threadId: string,
): Promise<ThreadReplyRow[]> {
  if (!sql) return [];
  await ensureNeonTables();
  const rows = await sql`
    SELECT * FROM forum_thread_replies_neon
    WHERE thread_id = ${threadId}
    ORDER BY timestamp ASC, id ASC
  `;
  return rows as ThreadReplyRow[];
}

export async function persistForumThreadNeon(thread: {
  id: string;
  forumSlug: string;
  title: string;
  author: string;
  authorId: string;
  timestamp: string;
  verificationStatus: string;
  tags: string;
  excerpt: string;
  upvotes: number;
  views: number;
}) {
  if (!sql) return;
  await ensureNeonTables();
  await sql`
    INSERT INTO forum_threads_neon (
      id, forum_slug, title, author, author_id, timestamp,
      reply_count, verification_status, tags, excerpt, upvotes, views
    ) VALUES (
      ${thread.id}, ${thread.forumSlug}, ${thread.title}, ${thread.author}, ${thread.authorId}, ${thread.timestamp},
      0, ${thread.verificationStatus}, ${thread.tags}, ${thread.excerpt}, ${thread.upvotes}, ${thread.views}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getForumThreadsNeon(
  forumSlug: string,
): Promise<ForumThreadRow[]> {
  if (!sql) return [];
  await ensureNeonTables();
  const rows = await sql`
    SELECT * FROM forum_threads_neon
    WHERE forum_slug = ${forumSlug}
    ORDER BY timestamp DESC, id DESC
  `;
  return rows as ForumThreadRow[];
}
