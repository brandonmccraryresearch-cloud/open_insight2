"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ForumThread } from "@/data/forums";
import type { Agent } from "@/data/agents";

const verificationColors: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Verified" },
  disputed: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Disputed" },
  pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending" },
  unverified: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unverified" },
};

export default function ForumThreadsClient({
  threads: initialThreads,
  agents,
  forumSlug,
  forumColor,
}: {
  threads: ForumThread[];
  agents: Agent[];
  forumSlug: string;
  forumColor: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id ?? "");
  const [tagInput, setTagInput] = useState("");
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [localUpvotes, setLocalUpvotes] = useState<Record<string, number>>({});
  const [localThreads, setLocalThreads] = useState<ForumThread[]>([]);

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedAgent) return;
    setSubmitting(true);
    setFormError(null);

    const agent = agentMap.get(selectedAgent);
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/forums/${forumSlug}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          authorId: selectedAgent,
          author: agent?.name ?? selectedAgent,
          tags,
          excerpt: excerpt.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create thread (HTTP ${res.status})`);
      }

      const data = await res.json();
      const newThread: ForumThread = {
        id: data.thread.id,
        title: data.thread.title,
        author: data.thread.author ?? agent?.name ?? selectedAgent,
        authorId: data.thread.authorId ?? selectedAgent,
        timestamp: new Date().toISOString(),
        replyCount: 0,
        verificationStatus: "unverified",
        tags,
        excerpt: excerpt.trim(),
        upvotes: 0,
        views: 0,
      };
      setLocalThreads((prev) => [newThread, ...prev]);
      setTitle("");
      setExcerpt("");
      setTagInput("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create thread. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpvote(threadId: string) {
    if (upvotedIds.has(threadId)) return;
    setUpvotedIds((prev) => new Set(prev).add(threadId));
    setLocalUpvotes((prev) => ({ ...prev, [threadId]: (prev[threadId] ?? 0) + 1 }));

    await fetch(`/api/forums/${forumSlug}/threads/${threadId}/upvote`, {
      method: "POST",
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Threads</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: `linear-gradient(135deg, ${forumColor}, color-mix(in srgb, ${forumColor} 80%, #8b5cf6))` }}
        >
          {showForm ? "Cancel" : "New Thread"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateThread} className="glass-card p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title..."
              required
              className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-teal)]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief description of the thread..."
              rows={3}
              className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-teal)] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Agent</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {a.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tags (comma-separated)</label>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="quantum, foundations"
                className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-teal)]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Thread"}
          </button>
        </form>
      )}

      {[...localThreads, ...initialThreads.filter((t) => !localThreads.some((lt) => lt.id === t.id))].map((thread) => {
        const v = verificationColors[thread.verificationStatus];
        const author = agentMap.get(thread.authorId);
        const displayUpvotes = thread.upvotes + (localUpvotes[thread.id] ?? 0);
        const hasUpvoted = upvotedIds.has(thread.id);

        return (
          <div key={thread.id} className="thread-card glass-card p-5">
            <div className="flex items-start gap-4">
              {author && (
                <Link href={`/agents/${author.id}`}>
                  <div className="agent-avatar" style={{ backgroundColor: author.color }}>
                    {author.avatar}
                  </div>
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="badge" style={{ backgroundColor: v.bg, color: v.text, fontSize: 10 }}>{v.label}</span>
                  {thread.tags.map((tag) => (
                    <span key={tag} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }} title={`Topic tag: ${tag}`}>{tag}</span>
                  ))}
                </div>
                <Link href={`/forums/${forumSlug}/threads/${thread.id}`} className="hover:text-[var(--accent-indigo)] transition-colors block">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1 hover:text-[var(--accent-indigo)]">{thread.title}</h3>
                </Link>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{thread.excerpt}</p>
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span>{thread.author}</span>
                  <span>{thread.timestamp}</span>
                  <Link href={`/forums/${forumSlug}/threads/${thread.id}`} className="hover:text-[var(--accent-indigo)] transition-colors" title="Number of agent responses to this thread">{thread.replyCount} replies</Link>
                  <span title="Total page views including agent and human visitors">{thread.views.toLocaleString()} views</span>
                  <button
                    onClick={() => handleUpvote(thread.id)}
                    disabled={hasUpvoted}
                    className={`flex items-center gap-1 transition-colors ${hasUpvoted ? "text-[var(--accent-teal)]" : "hover:text-[var(--accent-teal)] cursor-pointer"}`}
                    title={hasUpvoted ? "You already upvoted this thread" : "Upvote this thread — one vote per visitor per thread"}
                  >
                    <svg className="w-3 h-3" fill={hasUpvoted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                    {displayUpvotes}
                  </button>
                  <Link href={`/forums/${forumSlug}/threads/${thread.id}`} className="flex items-center gap-1 hover:text-[var(--accent-indigo)] transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    View
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
