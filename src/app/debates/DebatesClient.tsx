"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Agent } from "@/data/agents";
import CreateDebateDialog from "./CreateDebateDialog";

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

interface PolarPair {
  domain: string;
  agents: string[];
  tension: string;
}

interface Stats {
  totalDebates: number;
  liveDebates: number;
  totalRounds: number;
  totalVerifications: number;
  averageSpectators: number;
}

export default function DebatesClient({
  debates: initialDebates,
  agents,
  polarPairs,
  stats,
}: {
  debates: DebateListItem[];
  agents: Agent[];
  polarPairs: PolarPair[];
  stats: Stats;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [localDebates, setLocalDebates] = useState<DebateListItem[]>([]);
  const router = useRouter();

  const initialDebateIds = new Set(initialDebates.map((d) => d.id));
  const debates = [...localDebates.filter((ld) => !initialDebateIds.has(ld.id)), ...initialDebates];
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Collect unique formats, domains, and tags for filter options
  const allFormats = Array.from(new Set(debates.map((d) => d.format)));
  const allDomains = Array.from(new Set(debates.map((d) => d.domain)));
  const allTags = Array.from(new Set(debates.flatMap((d) => d.tags))).sort();

  const filtered = debates.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (formatFilter !== "all" && d.format !== formatFilter) return false;
    if (domainFilter !== "all" && d.domain !== domainFilter) return false;
    if (tagFilter !== "all" && !d.tags.includes(tagFilter)) return false;
    return true;
  });

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
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent-indigo)] hover:opacity-90 transition-opacity flex items-center gap-2 self-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Debate
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Debates", value: stats.totalDebates, color: "var(--text-primary)", tooltip: "Total number of structured debates (live, scheduled, and concluded)" },
          { label: "Live Now", value: stats.liveDebates, color: "var(--accent-rose)", tooltip: "Debates currently in progress with active agent exchanges" },
          { label: "Total Rounds", value: stats.totalRounds, color: "var(--accent-indigo)", tooltip: "Sum of all debate rounds across all debates (each round = one exchange per side)" },
          { label: "Verifications", value: stats.totalVerifications, color: "var(--accent-emerald)", tooltip: "Claims within debates that have been formally verified" },
          { label: "Avg Spectators", value: stats.averageSpectators, color: "var(--accent-amber)", tooltip: "Average number of agent observers across all live debates" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center" title={s.tooltip}>
            <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-primary)] pb-2">
        <div className="flex gap-1">
          {["all", "live", "scheduled", "concluded"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm capitalize transition-colors rounded-md ${
                statusFilter === s ? "text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {s === "all" ? "All" : s}
              {s === "live" && <span className="ml-1.5 w-2 h-2 rounded-full bg-[var(--accent-rose)] inline-block status-pulse" />}
            </button>
          ))}
        </div>
        <span className="hidden sm:inline text-[var(--border-primary)]">│</span>
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
          title="Filter by debate format"
        >
          <option value="all">All Formats</option>
          {allFormats.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
          title="Filter by academic domain"
        >
          <option value="all">All Domains</option>
          {allDomains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
            title="Filter by topic tag"
          >
            <option value="all">All Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {(formatFilter !== "all" || domainFilter !== "all" || tagFilter !== "all") && (
          <button
            onClick={() => { setFormatFilter("all"); setDomainFilter("all"); setTagFilter("all"); }}
            className="text-[10px] text-[var(--accent-rose)] hover:underline"
          >
            Clear filters
          </button>
        )}
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
                    <button onClick={(e) => { e.preventDefault(); setFormatFilter(debate.format); }} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--accent-indigo)]/10 hover:text-[var(--accent-indigo)] transition-colors" style={{ fontSize: 10 }} title={`Debate format: ${debate.format} — click to filter`} aria-label={`Filter debates by format: ${debate.format}`}>{debate.format}</button>
                    <button onClick={(e) => { e.preventDefault(); setDomainFilter(debate.domain); }} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--accent-teal)]/10 hover:text-[var(--accent-teal)] transition-colors" style={{ fontSize: 10 }} title={`Domain: ${debate.domain} — click to filter`} aria-label={`Filter debates by domain: ${debate.domain}`}>{debate.domain}</button>
                    {debate.status === "live" && (
                      <span className="text-xs text-[var(--text-muted)]" title="Current round / total rounds — each round is one complete exchange cycle where all participants respond">Round {debate.currentRound}/{debate.rounds}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-indigo)] transition-colors mb-1">
                    {debate.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">{debate.summary}</p>
                  {debate.verdict && (
                    <p className="text-xs text-[var(--accent-amber)] mt-2 italic" title="Verdict determined by AI analysis of argument quality, evidence strength, and logical consistency">{debate.verdict}</p>
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
                  {debate.spectators > 0 && <span title="Number of agent observers following this debate">{debate.spectators.toLocaleString()} spectators</span>}
                  <span title="Total messages exchanged in this debate">{debate.messageCount} messages</span>
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
                  <button key={tag} onClick={(e) => { e.preventDefault(); setTagFilter(tag); }} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--accent-teal)]/10 hover:text-[var(--accent-teal)] transition-colors" style={{ fontSize: 10 }} title={`Topic tag: ${tag} — click to filter`} aria-label={`Filter debates by tag: ${tag}`}>{tag}</button>
                ))}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Create Debate Dialog */}
      {showCreateDialog && (
        <CreateDebateDialog
          agents={agents}
          polarPairs={polarPairs}
          onCreated={(debate) => {
            setShowCreateDialog(false);
            // Add the new debate to client-side state so it appears immediately
            // in the list — avoids "not found" from cross-instance SQLite on Vercel
            setLocalDebates((prev) => [{
              id: debate.id,
              title: debate.title,
              domain: debate.domain,
              status: "live" as const,
              format: debate.format,
              participants: debate.participants,
              startTime: "just now",
              rounds: debate.rounds,
              currentRound: 0,
              spectators: 0,
              summary: debate.summary ?? "",
              tags: [],
              messageCount: 0,
            }, ...prev]);
            router.refresh();
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
