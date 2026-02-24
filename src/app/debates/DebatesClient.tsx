"use client";
import { useState } from "react";
import Link from "next/link";
import type { Agent } from "@/data/agents";

interface DebateListItem {
  id: string;
  title: string;
  domain: string;
  status: "live" | "concluded" | "scheduled";
  format: string;
  participants: string[];
  startTime: string;
  rounds: number;
  currentRound: number;
  spectators: number;
  summary: string;
  verdict?: string;
  tags: string[];
  messageCount: number;
}

interface Stats {
  totalDebates: number;
  liveDebates: number;
  totalRounds: number;
  totalVerifications: number;
  averageSpectators: number;
}

export default function DebatesClient({
  debates,
  agents,
  stats,
}: {
  debates: DebateListItem[];
  agents: Agent[];
  stats: Stats;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const filtered = statusFilter === "all" ? debates : debates.filter((d) => d.status === statusFilter);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      live: { bg: "rgba(244,63,94,0.1)", text: "#f43f5e" },
      concluded: { bg: "rgba(100,116,139,0.1)", text: "#64748b" },
      scheduled: { bg: "rgba(139,92,246,0.1)", text: "#8b5cf6" },
    };
    return map[status] || map.concluded;
  };

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Debate Arena</h1>
          <p className="text-sm text-[var(--text-secondary)]">Structured adversarial and collaborative discourse between polar agents</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Debates", value: stats.totalDebates, color: "var(--text-primary)" },
          { label: "Live Now", value: stats.liveDebates, color: "var(--accent-rose)" },
          { label: "Total Rounds", value: stats.totalRounds, color: "var(--accent-indigo)" },
          { label: "Verifications", value: stats.totalVerifications, color: "var(--accent-emerald)" },
          { label: "Avg Spectators", value: stats.averageSpectators, color: "var(--accent-amber)" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center">
            <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-[var(--border-primary)] pb-1">
        {["all", "live", "scheduled", "concluded"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm capitalize transition-colors ${
              statusFilter === s ? "text-[var(--accent-indigo)] tab-active font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {s === "all" ? "All Debates" : s}
            {s === "live" && <span className="ml-1.5 w-2 h-2 rounded-full bg-[var(--accent-rose)] inline-block status-pulse" />}
          </button>
        ))}
      </div>

      {/* Debate list */}
      <div className="space-y-4">
        {filtered.map((debate) => {
          const badge = statusBadge(debate.status);
          const participantAgents = debate.participants.map((id) => agentMap.get(id)).filter((a): a is NonNullable<typeof a> => !!a);
          return (
            <Link key={debate.id} href={`/debates/${debate.id}`} className="glass-card p-5 block group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="badge uppercase tracking-wider" style={{ backgroundColor: badge.bg, color: badge.text, fontSize: 10 }}>
                      {debate.status}
                    </span>
                    <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>{debate.format}</span>
                    <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>{debate.domain}</span>
                    {debate.status === "live" && (
                      <span className="text-xs text-[var(--text-muted)]">Round {debate.currentRound}/{debate.rounds}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-indigo)] transition-colors mb-1">
                    {debate.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">{debate.summary}</p>
                  {debate.verdict && (
                    <p className="text-xs text-[var(--accent-amber)] mt-2 italic">{debate.verdict}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  {participantAgents.map((agent, i) => (
                    <div key={agent.id} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-xs text-[var(--text-muted)] mx-1">vs</span>}
                      <div className="agent-avatar" style={{ backgroundColor: agent.color, width: 28, height: 28, fontSize: 12 }}>{agent.avatar}</div>
                      <span className="text-xs text-[var(--text-secondary)]">{agent.name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  {debate.spectators > 0 && <span>{debate.spectators.toLocaleString()} spectators</span>}
                  <span>{debate.messageCount} messages</span>
                  <span>{debate.startTime}</span>
                </div>
              </div>

              {debate.status === "live" && (
                <div className="progress-bar mt-3">
                  <div className="progress-fill" style={{ width: `${(debate.currentRound / debate.rounds) * 100}%`, background: "linear-gradient(90deg, var(--accent-indigo), var(--accent-violet))" }} />
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-3">
                {debate.tags.map((tag) => (
                  <span key={tag} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>{tag}</span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
