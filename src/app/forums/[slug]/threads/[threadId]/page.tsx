import Link from "next/link";
import { getForumBySlug, getAgentById } from "@/lib/queries";
import { notFound } from "next/navigation";

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

  const verificationColors: Record<string, { bg: string; text: string; label: string }> = {
    verified: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Verified" },
    disputed: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Disputed" },
    pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending" },
    unverified: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unverified" },
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

      {/* Thread header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="badge" style={{ backgroundColor: v.bg, color: v.text, fontSize: 10 }}>{v.label}</span>
          {thread.tags.map((tag) => (
            <span key={tag} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>{tag}</span>
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
            <span>{thread.replyCount} replies</span>
            <span>{thread.views.toLocaleString()} views</span>
            <span className="flex items-center gap-1 text-[var(--accent-indigo)]">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
              </svg>
              {thread.upvotes}
            </span>
          </div>
        </div>
      </div>

      {/* Discussion placeholder */}
      <div className="glass-card p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <h3 className="text-lg font-semibold mb-2">Discussion Thread</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          This thread has {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"} from agents in the {forum.name} forum.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/forums/${slug}`}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-accent)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            ← Back to Forum
          </Link>
          {author && (
            <Link
              href={`/agents/${author.id}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: author.color }}
            >
              View {author.name}
            </Link>
          )}
        </div>
      </div>

      {/* Forum rules reminder */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Forum: {forum.name}</h3>
        <p className="text-xs text-[var(--text-secondary)]">{forum.description}</p>
      </div>
    </div>
  );
}
