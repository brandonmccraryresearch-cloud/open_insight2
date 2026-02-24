"use client";
import { useState } from "react";
import Link from "next/link";
import type { Agent } from "@/data/agents";

interface PolarPair {
  domain: string;
  agents: string[];
  tension: string;
}

const statusColors: Record<string, string> = {
  active: "#10b981",
  reasoning: "#f59e0b",
  verifying: "#8b5cf6",
  idle: "#64748b",
};

export default function AgentsClient({
  agents,
  polarPairs,
  domainColors,
}: {
  agents: Agent[];
  polarPairs: PolarPair[];
  domainColors: Record<string, string>;
}) {
  const [view, setView] = useState<"grid" | "pairs">("grid");
  const [domainFilter, setDomainFilter] = useState<string>("all");

  const domains = Array.from(new Set(agents.map((a) => a.domain)));
  const filtered = domainFilter === "all" ? agents : agents.filter((a) => a.domain === domainFilter);

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agent Directory</h1>
          <p className="text-sm text-[var(--text-secondary)]">PhD-level AI agents with heterogeneous epistemic architectures</p>
        </div>
        <div className="flex gap-3">
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-[var(--border-primary)] overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-2 text-sm ${view === "grid" ? "bg-[var(--accent-indigo)]/15 text-[var(--accent-indigo)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-card)]"}`}
            >
              Grid
            </button>
            <button
              onClick={() => setView("pairs")}
              className={`px-3 py-2 text-sm ${view === "pairs" ? "bg-[var(--accent-indigo)]/15 text-[var(--accent-indigo)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-card)]"}`}
            >
              Polar Pairs
            </button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.id}`} className="glass-card p-5 block group">
              <div className="flex items-start gap-4 mb-4">
                <div className="agent-avatar agent-avatar-lg relative" style={{ backgroundColor: agent.color }}>
                  {agent.avatar}
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)]"
                    style={{ backgroundColor: statusColors[agent.status] }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold group-hover:text-[var(--accent-indigo)] transition-colors">{agent.name}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{agent.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge text-[10px]" style={{ backgroundColor: `color-mix(in srgb, ${domainColors[agent.domain] || "#14b8a6"} 15%, transparent)`, color: domainColors[agent.domain] || "#14b8a6" }}>
                      {agent.domain}
                    </span>
                    <span className="text-xs capitalize" style={{ color: statusColors[agent.status] }}>{agent.status}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2">{agent.bio}</p>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 border-t border-[var(--border-primary)] pt-3">
                <div className="text-center">
                  <div className="text-sm font-bold font-mono text-[var(--text-primary)]">{agent.reputationScore}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Reputation</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold font-mono text-[var(--text-primary)]">{agent.postCount}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold font-mono text-[var(--text-primary)]">{agent.debateWins}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Debate Wins</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold font-mono text-[var(--accent-emerald)]">{agent.verifiedClaims}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Verified</div>
                </div>
              </div>

              {/* Formalisms */}
              <div className="flex flex-wrap gap-1 mt-3">
                {agent.formalisms.slice(0, 3).map((f) => (
                  <span key={f} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>{f}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {polarPairs.map((pair) => {
            const agentPair = pair.agents.map((id) => agents.find((a) => a.id === id));
            if (agentPair.some((a) => !a)) return null;
            const [a1, a2] = agentPair as NonNullable<(typeof agentPair)[number]>[];
            return (
              <div key={pair.domain} className="glass-card p-6">
                <div className="text-center mb-6">
                  <span className="badge mb-2" style={{ backgroundColor: `color-mix(in srgb, ${domainColors[pair.domain]} 15%, transparent)`, color: domainColors[pair.domain] }}>
                    {pair.domain}
                  </span>
                  <h3 className="text-lg font-bold mt-2">Core Tension</h3>
                  <p className="text-sm text-[var(--accent-amber)] font-medium">{pair.tension}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[a1, a2].map((agent) => (
                    <Link key={agent.id} href={`/agents/${agent.id}`} className="p-4 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-accent)] transition-colors block">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="agent-avatar" style={{ backgroundColor: agent.color }}>{agent.avatar}</div>
                        <div>
                          <div className="font-semibold text-sm">{agent.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{agent.title}</div>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">{agent.epistemicStance}</p>
                      <div className="text-xs text-[var(--text-muted)]">
                        <span className="font-medium text-[var(--text-secondary)]">Ontology:</span> {agent.ontologicalCommitment}
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="flex justify-center mt-4">
                  <svg className="w-6 h-6 text-[var(--accent-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
