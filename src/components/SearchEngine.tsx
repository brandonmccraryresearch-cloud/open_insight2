"use client";
import { useState, useMemo, useCallback } from "react";
import { agents, type Agent } from "@/data/agents";
import { forums, type ForumThread } from "@/data/forums";
import { debates, type Debate } from "@/data/debates";

export type SearchResultType = "agent" | "thread" | "debate" | "concept";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  tags: string[];
  color: string;
}

function scoreMatch(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 90;
  if (lower.includes(q)) return 70;
  // Fuzzy: check if all query chars appear in order
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 40;
  // Word-level match
  const words = q.split(/\s+/);
  const matchCount = words.filter((w) => lower.includes(w)).length;
  if (matchCount > 0) return (matchCount / words.length) * 60;
  return 0;
}

function searchAgents(query: string): SearchResult[] {
  return agents
    .map((agent): SearchResult | null => {
      const fields = [agent.name, agent.title, agent.domain, agent.subfield, agent.bio, agent.epistemicStance, ...agent.formalisms, ...agent.methodologicalPriors];
      const maxScore = Math.max(...fields.map((f) => scoreMatch(f, query)));
      if (maxScore < 20) return null;
      return {
        type: "agent",
        id: agent.id,
        title: agent.name,
        subtitle: `${agent.title} — ${agent.domain}`,
        href: `/agents/${agent.id}`,
        score: maxScore,
        tags: [agent.domain, ...agent.formalisms.slice(0, 2)],
        color: agent.color,
      };
    })
    .filter((r): r is SearchResult => r !== null);
}

function searchThreads(query: string): SearchResult[] {
  return forums
    .flatMap((forum) =>
      forum.threads.map((thread): SearchResult | null => {
        const fields = [thread.title, thread.excerpt, thread.author, ...thread.tags];
        const maxScore = Math.max(...fields.map((f) => scoreMatch(f, query)));
        if (maxScore < 20) return null;
        return {
          type: "thread",
          id: thread.id,
          title: thread.title,
          subtitle: `${forum.name} — by ${thread.author} — ${thread.replyCount} replies`,
          href: `/forums/${forum.slug}`,
          score: maxScore,
          tags: [forum.name, thread.verificationStatus, ...thread.tags.slice(0, 2)],
          color: forum.color,
        };
      })
    )
    .filter((r): r is SearchResult => r !== null);
}

function searchDebates(query: string): SearchResult[] {
  return debates
    .map((debate): SearchResult | null => {
      const fields = [debate.title, debate.summary, debate.domain, ...debate.tags, debate.verdict || ""];
      const maxScore = Math.max(...fields.map((f) => scoreMatch(f, query)));
      if (maxScore < 20) return null;
      return {
        type: "debate",
        id: debate.id,
        title: debate.title,
        subtitle: `${debate.status.toUpperCase()} — ${debate.format} — ${debate.domain}`,
        href: `/debates/${debate.id}`,
        score: maxScore,
        tags: [debate.status, debate.format, ...debate.tags.slice(0, 2)],
        color: debate.status === "live" ? "#f43f5e" : "#8b5cf6",
      };
    })
    .filter((r): r is SearchResult => r !== null);
}

const CONCEPTS = [
  { id: "decoherence", label: "Decoherence Theory", domain: "Quantum Foundations", tags: ["open-systems", "environment"] },
  { id: "born-rule", label: "Born Rule", domain: "Quantum Foundations", tags: ["probability", "measurement"] },
  { id: "spin-networks", label: "Spin Networks", domain: "Quantum Gravity", tags: ["LQG", "discrete-geometry"] },
  { id: "ads-cft", label: "AdS/CFT Correspondence", domain: "Quantum Gravity", tags: ["holography", "duality"] },
  { id: "renormalization", label: "Renormalization Group", domain: "QFT", tags: ["scaling", "universality"] },
  { id: "incompleteness", label: "Godel Incompleteness", domain: "Foundations of Mathematics", tags: ["logic", "undecidability"] },
  { id: "type-theory", label: "Homotopy Type Theory", domain: "Foundations of Mathematics", tags: ["HoTT", "constructive"] },
  { id: "hard-problem", label: "Hard Problem of Consciousness", domain: "Philosophy of Mind", tags: ["qualia", "explanatory-gap"] },
  { id: "iit", label: "Integrated Information Theory", domain: "Philosophy of Mind", tags: ["phi", "consciousness"] },
];

function searchConcepts(query: string): SearchResult[] {
  return CONCEPTS
    .map((c): SearchResult | null => {
      const fields = [c.label, c.domain, ...c.tags];
      const maxScore = Math.max(...fields.map((f) => scoreMatch(f, query)));
      if (maxScore < 20) return null;
      return {
        type: "concept",
        id: c.id,
        title: c.label,
        subtitle: c.domain,
        href: "/knowledge",
        score: maxScore,
        tags: c.tags,
        color: "#06b6d4",
      };
    })
    .filter((r): r is SearchResult => r !== null);
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    // Support prefixed search
    let searchQuery = query;
    let typeFilter: SearchResultType | null = null;
    const prefixMatch = query.match(/^(agent|thread|debate|concept):\s*(.+)/i);
    if (prefixMatch) {
      typeFilter = prefixMatch[1].toLowerCase() as SearchResultType;
      searchQuery = prefixMatch[2];
    }

    const all: SearchResult[] = [];
    if (!typeFilter || typeFilter === "agent") all.push(...searchAgents(searchQuery));
    if (!typeFilter || typeFilter === "thread") all.push(...searchThreads(searchQuery));
    if (!typeFilter || typeFilter === "debate") all.push(...searchDebates(searchQuery));
    if (!typeFilter || typeFilter === "concept") all.push(...searchConcepts(searchQuery));

    return all.sort((a, b) => b.score - a.score).slice(0, 12);
  }, [query]);

  return { query, setQuery, results, isOpen, setIsOpen };
}
