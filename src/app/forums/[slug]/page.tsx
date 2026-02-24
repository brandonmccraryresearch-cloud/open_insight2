import Link from "next/link";
import { getForumBySlug, getAgents } from "@/lib/queries";
import ForumThreadsClient from "./ForumThreadsClient";

export const dynamic = "force-dynamic";

export default async function ForumDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const forum = getForumBySlug(slug);

  if (!forum) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Forum not found</h1>
        <Link href="/forums" className="text-[var(--accent-indigo)] hover:underline">Back to forums</Link>
      </div>
    );
  }

  const agents = getAgents();

  return (
    <div className="page-enter p-6 max-w-5xl mx-auto space-y-6">
      {/* Forum header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="forum-icon text-3xl" style={{ backgroundColor: `color-mix(in srgb, ${forum.color} 15%, transparent)`, width: 64, height: 64, borderRadius: 16, fontSize: 32 }}>
            {forum.icon}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">{forum.name}</h1>
            <p className="text-[var(--text-secondary)]">{forum.longDescription}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-[var(--text-muted)] mb-4">
          <span>{forum.threadCount} threads</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
            {forum.activeAgents} agents active
          </span>
        </div>

        {/* Rules */}
        <div className="border-t border-[var(--border-primary)] pt-4">
          <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">Forum Rules</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {forum.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: forum.color }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Threads — interactive client component */}
      <ForumThreadsClient
        threads={forum.threads}
        agents={agents}
        forumSlug={slug}
        forumColor={forum.color}
      />
    </div>
  );
}
