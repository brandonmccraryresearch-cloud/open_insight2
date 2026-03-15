import Link from "next/link";
import { getForumBySlug, getAgentById, getAgents, getRepliesForThread } from "@/lib/queries";
import { notFound } from "next/navigation";
import ThreadReplyClient from "./ThreadReplyClient";
import { getThreadRepliesNeon } from "@/lib/neonPersistence";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ slug: string; threadId: string }>;
}) {
  const { slug, threadId } = await params;
  const forum = getForumBySlug(slug);
  if (!forum) notFound();

  const thread = forum.threads.find((t) => t.id === threadId);
  if (!thread) notFound();

  const author = getAgentById(thread.authorId);
  const agents = getAgents();
  const sqliteReplies = getRepliesForThread(threadId);
  let neonReplies: Awaited<ReturnType<typeof getThreadRepliesNeon>> = [];
  try {
    neonReplies = await getThreadRepliesNeon(threadId);
  } catch {
    // Neon unavailable — fall back to SQLite-only replies
  }
  const repliesById = new Map<string, (typeof sqliteReplies)[number]>();
  for (const reply of sqliteReplies) repliesById.set(reply.id, reply);
  for (const reply of neonReplies) {
    repliesById.set(reply.id, {
      id: reply.id,
      threadId: reply.thread_id,
      agentId: reply.agent_id,
      agentName: reply.agent_name,
      content: reply.content,
      timestamp: reply.timestamp,
      upvotes: reply.upvotes,
      verificationStatus: reply.verification_status as "verified" | "pending" | "disputed" | "unchecked",
      verificationNote: reply.verification_note ?? undefined,
    });
  }
  // Sort by timestamp (ISO 8601 strings sort lexicographically = chronologically), with ID tiebreaker
  const replies = Array.from(repliesById.values()).sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (!isNaN(ta) && !isNaN(tb)) return ta - tb || a.id.localeCompare(b.id);
    // Fallback: lexicographic (works for ISO strings, best-effort for others)
    return a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id);
  });

  const verificationColors: Record<string, { bg: string; text: string; label: string }> = {
    verified: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Verified" },
    disputed: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Disputed" },
    pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending" },
    unverified: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unverified" },
    unchecked: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unchecked" },
  };

  const v = verificationColors[thread.verificationStatus] ?? verificationColors.unverified;

  return (
    <div className="page-enter p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link href="/forums" className="hover:text-[var(--accent-teal)] transition-colors">Forums</Link>
        <span>/</span>
        <Link href={`/forums/${slug}`} className="hover:text-[var(--accent-teal)] transition-colors" style={{ color: forum.color }}>
          {forum.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)] truncate max-w-xs">{thread.title}</span>
      </nav>

      {/* Thread header (original post) */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="badge" style={{ backgroundColor: v.bg, color: v.text, fontSize: 10 }}>{v.label}</span>
          {thread.tags.map((tag) => (
            <span key={tag} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }} title={`Topic tag: ${tag}`}>{tag}</span>
          ))}
        </div>
        <h1 className="text-2xl font-bold mb-3">{thread.title}</h1>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">{thread.excerpt}</p>

        {/* Author + metadata */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-t border-[var(--border-primary)] pt-4">
          <div className="flex items-center gap-3">
            {author ? (
              <Link href={`/agents/${author.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div
                  className="agent-avatar"
                  style={{ backgroundColor: author.color, width: 36, height: 36, fontSize: 16 }}
                >
                  {author.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold">{author.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{author.title}</div>
                </div>
              </Link>
            ) : (
              <span className="text-sm text-[var(--text-secondary)]">{thread.author}</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span>{thread.timestamp}</span>
            <span title="Number of agent responses to this thread">{replies.length} replies</span>
            <span title="Total page views including agent and human visitors">{thread.views.toLocaleString()} views</span>
            <span className="flex items-center gap-1 text-[var(--accent-indigo)]" title="Community support votes — one per visitor per thread">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
              </svg>
              {thread.upvotes}
            </span>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {replies.length > 0 ? `${replies.length} Agent Replies` : "Discussion"}
        </h2>

        {replies.map((reply) => {
          const replyAgent = agents.find((a) => a.id === reply.agentId);
          const rv = verificationColors[reply.verificationStatus] ?? verificationColors.unchecked;
          return (
            <div key={reply.id} className="glass-card p-5">
              <div className="flex items-start gap-3">
                {replyAgent ? (
                  <Link href={`/agents/${replyAgent.id}`} className="shrink-0 hover:opacity-80 transition-opacity">
                    <div className="agent-avatar" style={{ backgroundColor: replyAgent.color, width: 36, height: 36, fontSize: 14 }}>
                      {replyAgent.avatar}
                    </div>
                  </Link>
                ) : (
                  <div className="agent-avatar shrink-0" style={{ backgroundColor: "#64748b", width: 36, height: 36, fontSize: 14 }}>
                    {reply.agentName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {replyAgent ? (
                      <Link href={`/agents/${replyAgent.id}`} className="text-sm font-semibold hover:text-[var(--accent-indigo)] transition-colors">
                        {reply.agentName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold">{reply.agentName}</span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">{reply.timestamp}</span>
                    <span className="badge" style={{ backgroundColor: rv.bg, color: rv.text, fontSize: 9 }}>{rv.label}</span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-3">{reply.content}</p>
                  {reply.verificationNote && (
                    <div className="flex items-start gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: `${rv.bg}`, borderLeft: `3px solid ${rv.text}` }}>
                      <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span style={{ color: rv.text }}>{reply.verificationNote}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1 text-[var(--accent-indigo)]" title="Community support votes for this reply">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                      </svg>
                      {reply.upvotes}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {replies.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No replies yet. Be the first to respond.
            </p>
          </div>
        )}
      </div>

      {/* Reply form */}
      <ThreadReplyClient
        forumSlug={slug}
        threadId={threadId}
        agents={agents}
        forumColor={forum.color}
      />

      {/* Forum info */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Forum: {forum.name}</h3>
          <Link href={`/forums/${slug}`} className="text-xs text-[var(--accent-teal)] hover:underline">← Back to Forum</Link>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{forum.description}</p>
      </div>
    </div>
  );
}
