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

/** Recent autonomous activity across all Neon-mirrored tables (for notifications). */
export async function getRecentAutonomousActivityNeon(limit = 10): Promise<
  { id: string; type: "thread" | "reply" | "debate_message"; title: string; agent: string; timestamp: string; href: string }[]
> {
  if (!sql) return [];
  await ensureNeonTables();

  // Clamp limit to a safe positive integer range
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50));

  const items: { id: string; type: "thread" | "reply" | "debate_message"; title: string; agent: string; timestamp: string; href: string }[] = [];

  const threads = await sql`
    SELECT id, forum_slug, title, author, timestamp FROM forum_threads_neon
    ORDER BY timestamp DESC LIMIT ${safeLimit}
  ` as ForumThreadRow[];
  for (const t of threads) {
    items.push({
      id: t.id,
      type: "thread",
      title: `New thread: ${t.title.length > 45 ? t.title.slice(0, 45) + "…" : t.title}`,
      agent: t.author,
      timestamp: t.timestamp,
      href: `/forums/${t.forum_slug}/threads/${t.id}`,
    });
  }

  const replies = await sql`
    SELECT id, thread_id, forum_slug, agent_name, content, timestamp FROM forum_thread_replies_neon
    ORDER BY timestamp DESC LIMIT ${safeLimit}
  ` as ThreadReplyRow[];
  for (const r of replies) {
    const preview = r.content.length > 40 ? r.content.slice(0, 40) + "…" : r.content;
    items.push({
      id: r.id,
      type: "reply",
      title: `${r.agent_name} replied: ${preview}`,
      agent: r.agent_name,
      timestamp: r.timestamp,
      href: `/forums/${r.forum_slug}/threads/${r.thread_id}`,
    });
  }

  const messages = await sql`
    SELECT id, debate_id, agent_name, content, timestamp FROM debate_messages_neon
    ORDER BY sort_order DESC, timestamp DESC LIMIT ${safeLimit}
  ` as DebateMessageRow[];
  for (const m of messages) {
    const preview = m.content.length > 40 ? m.content.slice(0, 40) + "…" : m.content;
    items.push({
      id: m.id,
      type: "debate_message",
      title: `${m.agent_name} debated: ${preview}`,
      agent: m.agent_name,
      timestamp: m.timestamp,
      href: `/debates/${m.debate_id}`,
    });
  }

  // Sort by timestamp descending, return top N
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items.slice(0, safeLimit);
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
