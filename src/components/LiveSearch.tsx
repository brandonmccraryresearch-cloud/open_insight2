"use client";
import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { agents } from "@/data/agents";
import { forums } from "@/data/forums";
import { debates } from "@/data/debates";

export type SearchResultType = "agent" | "forum" | "thread" | "debate";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  color: string;
  tags: string[];
  score: number; // relevance score 0-100
}

function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = [];

  agents.forEach((a) => {
    results.push({
      type: "agent",
      id: a.id,
      title: a.name,
      subtitle: `${a.title} — ${a.domain}`,
      href: `/agents/${a.id}`,
      color: a.color,
      tags: [...a.formalisms, ...a.methodologicalPriors, a.domain, a.subfield],
      score: 0,
    });
  });

  forums.forEach((f) => {
    results.push({
      type: "forum",
      id: f.slug,
      title: f.name,
      subtitle: f.description,
      href: `/forums/${f.slug}`,
      color: f.color,
      tags: [],
      score: 0,
    });
    f.threads.forEach((t) => {
      results.push({
        type: "thread",
        id: t.id,
        title: t.title,
        subtitle: `${f.name} — by ${t.author}`,
        href: `/forums/${f.slug}`,
        color: f.color,
        tags: t.tags,
        score: 0,
      });
    });
  });

  debates.forEach((d) => {
    results.push({
      type: "debate",
      id: d.id,
      title: d.title,
      subtitle: `${d.domain} — ${d.format} — ${d.status}`,
      href: `/debates/${d.id}`,
      color: d.status === "live" ? "#f43f5e" : "#6366f1",
      tags: d.tags,
      score: 0,
    });
  });

  return results;
}

function scoreResult(result: SearchResult, query: string): number {
  const q = query.toLowerCase();
  let score = 0;

  // Title match (highest weight)
  if (result.title.toLowerCase().includes(q)) score += 50;
  if (result.title.toLowerCase().startsWith(q)) score += 20;

  // Subtitle match
  if (result.subtitle.toLowerCase().includes(q)) score += 30;

  // Tag match
  result.tags.forEach((tag) => {
    if (tag.toLowerCase().includes(q)) score += 15;
    if (tag.toLowerCase() === q) score += 25;
  });

  // Exact match bonus
  if (result.title.toLowerCase() === q) score += 50;

  return score;
}

const typeIcons: Record<SearchResultType, string> = {
  agent: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  forum: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z",
  thread: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
  debate: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
};

const typeLabels: Record<SearchResultType, string> = {
  agent: "Agent",
  forum: "Forum",
  thread: "Thread",
  debate: "Debate",
};

export function useLiveSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchIndex = useMemo(() => buildSearchIndex(), []);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return searchIndex
      .map((r) => ({ ...r, score: scoreResult(r, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [query, searchIndex]);

  const clear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
  }, []);

  return { query, setQuery, results, isOpen, setIsOpen, clear };
}

export function SearchResults({ results, onClose }: { results: SearchResult[]; onClose: () => void }) {
  if (results.length === 0) return null;

  const grouped = results.reduce<Record<SearchResultType, SearchResult[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {} as Record<SearchResultType, SearchResult[]>);

  return (
    <div className="absolute top-full mt-2 left-0 right-0 glass-card p-2 max-h-96 overflow-y-auto z-50">
      {(Object.entries(grouped) as [SearchResultType, SearchResult[]][]).map(([type, items]) => (
        <div key={type} className="mb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-3 py-1">
            {typeLabels[type]}s ({items.length})
          </div>
          {items.map((result) => (
            <Link
              key={result.id}
              href={result.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" style={{ color: result.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={typeIcons[type]} />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{result.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{result.subtitle}</div>
              </div>
              <div className="shrink-0 text-[10px] font-mono text-[var(--text-muted)]">{result.score}%</div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
