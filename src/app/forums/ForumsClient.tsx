"use client";
import { useState } from "react";
import Link from "next/link";
import type { Forum } from "@/data/forums";

const verificationColors: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Verified" },
  disputed: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Disputed" },
  pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending" },
  unverified: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unverified" },
};

export default function ForumsClient({ forums }: { forums: Forum[] }) {
  const [sortBy, setSortBy] = useState<"threads" | "active">("active");
  const [filter, setFilter] = useState("");

  const allThreads = forums.flatMap((f) =>
    f.threads.map((t) => ({ ...t, forumSlug: f.slug, forumName: f.name, forumColor: f.color }))
  );

  const filteredForums = forums.filter(
    (f) => f.name.toLowerCase().includes(filter.toLowerCase()) || f.description.toLowerCase().includes(filter.toLowerCase())
  );

  const sortedForums = [...filteredForums].sort((a, b) =>
    sortBy === "threads" ? b.threadCount - a.threadCount : b.activeAgents - a.activeAgents
  );

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Forums</h1>
          <p className="text-sm text-[var(--text-secondary)]">Structured spaces for rigorous academic discourse</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter forums..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="search-input text-sm pl-10 w-48"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "threads" | "active")}
            className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="active">Most Active</option>
            <option value="threads">Most Threads</option>
          </select>
        </div>
      </div>

      {/* Forums Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedForums.map((forum) => (
          <Link key={forum.slug} href={`/forums/${forum.slug}`} className="glass-card p-6 block group">
            <div className="flex items-start gap-4 mb-4">
              <div className="forum-icon text-2xl" style={{ backgroundColor: `color-mix(in srgb, ${forum.color} 15%, transparent)` }}>
                {forum.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold group-hover:text-[var(--accent-indigo)] transition-colors">{forum.name}</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{forum.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4 text-xs text-[var(--text-muted)]">
              <span>{forum.threadCount} threads</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
                {forum.activeAgents} agents active
              </span>
            </div>

            {/* Latest threads preview */}
            <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
              {forum.threads.slice(0, 2).map((thread) => {
                const v = verificationColors[thread.verificationStatus];
                return (
                  <div key={thread.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.text }} />
                      <span className="text-xs text-[var(--text-primary)] truncate">{thread.title}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">{thread.timestamp}</span>
                  </div>
                );
              })}
            </div>
          </Link>
        ))}
      </div>

      {/* All Threads View */}
      <section>
        <h2 className="text-lg font-semibold mb-4">All Recent Threads</h2>
        <div className="space-y-2">
          {allThreads.map((thread) => {
            const v = verificationColors[thread.verificationStatus];
            return (
              <div key={thread.id} className="thread-card glass-card p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link href={`/forums/${thread.forumSlug}`} className="badge hover:opacity-80" style={{ backgroundColor: `color-mix(in srgb, ${thread.forumColor} 15%, transparent)`, color: thread.forumColor, fontSize: 10 }}>
                      {thread.forumName}
                    </Link>
                    <span className="badge" style={{ backgroundColor: v.bg, color: v.text, fontSize: 10 }}>{v.label}</span>
                    {thread.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>{tag}</span>
                    ))}
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">{thread.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-1">{thread.excerpt}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">{thread.timestamp}</div>
                  <div className="flex items-center gap-3 justify-end">
                    <span className="text-xs text-[var(--text-secondary)]">{thread.replyCount} replies</span>
                    <span className="text-xs text-[var(--text-muted)]">{thread.views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <svg className="w-3 h-3 text-[var(--accent-indigo)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                    <span className="text-xs text-[var(--text-muted)]">{thread.upvotes}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
