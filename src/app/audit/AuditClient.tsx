"use client";
import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import {
  type AgentAction,
  type AgentFinding,
  type SessionState,
  getSessionState,
  subscribe,
  setSelectedDuration,
  getTimeRemaining,
  getElapsedTime,
  startSession,
  stopSession,
  pauseSession,
  resumeSession,
} from "@/lib/agentSessionStore";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_DURATIONS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
];

const severityStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Critical" },
  error: { bg: "rgba(220,38,38,0.1)", text: "#dc2626", label: "Error" },
  warning: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Warning" },
  info: { bg: "rgba(99,102,241,0.1)", text: "#6366f1", label: "Info" },
};

const categoryLabels: Record<string, string> = {
  "mock-data": "Seed-Only Data",
  "non-functional": "Non-Functional",
  placeholder: "Placeholder",
  inconsistency: "Inconsistency",
  error: "Error",
  http_error: "HTTP Error",
  emulation: "Emulation",
  incomplete: "Incomplete",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuditClient() {
  // Subscribe to global persistent session store (survives navigation)
  const session: SessionState = useSyncExternalStore(subscribe, getSessionState, getSessionState);
  const { actions: streamActions, findings: streamFindings, log: sessionLog, streaming, active, error } = session;

  // Local UI state
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");
  const [expandedActionIdx, setExpandedActionIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<"timeline" | "agents" | "findings" | "log">("timeline");

  const streamScrollRef = useRef<HTMLDivElement | null>(null);

  // Countdown timer — polls getTimeRemaining() every second
  useEffect(() => {
    if (!active) { setTimeRemaining(0); setElapsed(0); return; }
    const id = setInterval(() => {
      const rem = getTimeRemaining();
      setTimeRemaining(rem);
      setElapsed(getElapsedTime());
      if (rem <= 0 && active) {
        // Let the server-side time enforcement handle ending
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  // Auto-scroll
  useEffect(() => {
    if (streamScrollRef.current) {
      streamScrollRef.current.scrollTop = streamScrollRef.current.scrollHeight;
    }
  }, [streamActions]);

  // ─── Derived data ────────────────────────────────────────────────────────

  const activeAgents = Array.from(
    new Map(
      streamActions
        .filter((a) => a.agentId && a.agentId !== "system")
        .map((a) => [a.agentId, a.agentName] as const)
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredStreamActions = selectedAgentFilter === "all"
    ? streamActions
    : streamActions.filter((a) => a.agentId === selectedAgentFilter || a.type === "session_start" || a.type === "session_end");

  const agentStats = useCallback((agentId: string) => {
    const aa = streamActions.filter((a) => a.agentId === agentId);
    return {
      actions: aa.filter((a) => a.type === "action").length,
      thoughts: aa.filter((a) => a.type === "thought").length,
      findings: streamFindings.filter((f) => f.agentId === agentId).length,
      succeeded: aa.filter((a) => a.type === "action" && a.status === "success").length,
      failed: aa.filter((a) => a.type === "action" && (a.status === "failed" || a.status === "blocked")).length,
    };
  }, [streamActions, streamFindings]);

  const totalStats = {
    actions: streamActions.filter((a) => a.type === "action").length,
    thoughts: streamActions.filter((a) => a.type === "thought").length,
    findings: streamFindings.length,
    succeeded: streamActions.filter((a) => a.type === "action" && a.status === "success").length,
    failed: streamActions.filter((a) => a.type === "action" && (a.status === "failed" || a.status === "blocked")).length,
  };

  const actionCount = totalStats.actions;
  const elapsedMin = elapsed / 60;
  const actionsPerMin = elapsedMin > 0 ? actionCount / elapsedMin : 0;
  const successRate = actionCount > 0 ? (totalStats.succeeded / actionCount) * 100 : 0;
  const actionLatencies = streamActions.filter((a) => a.type === "action" && a.latency != null).map((a) => a.latency!);
  const avgResponseTime = actionLatencies.length > 0 ? actionLatencies.reduce((s, v) => s + v, 0) / actionLatencies.length : 0;

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function copyReport() {
    const lines: string[] = [
      `## 🔍 Open Insight Platform — Agent Session Report`,
      ``,
      `**Generated:** ${new Date().toLocaleString()}`,
      `**Mode:** Autonomous — **Live HTTP probing** (persistent agent context)`,
      `**Participating Agents:** ${activeAgents.map(a => a.name).join(", ")}`,
      ``,
      `### Agent Activity Summary`,
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Actions Attempted | ${totalStats.actions} |`,
      `| ✅ Succeeded | ${totalStats.succeeded} |`,
      `| ❌ Failed/Blocked | ${totalStats.failed} |`,
      `| 💭 Thoughts | ${totalStats.thoughts} |`,
      `| 📋 Findings | ${totalStats.findings} |`,
      ``,
    ];

    if (streamActions.length > 0) {
      lines.push(`### Activity Timeline`, ``);
      for (const a of streamActions) {
        if (a.type === "session_start" || a.type === "session_end") {
          lines.push(`- ⚙ **System**: ${a.detail}`);
        } else if (a.type === "thought") {
          lines.push(`- 💭 **${a.agentName}**: ${(a.detail || "").slice(0, 300)}`);
        } else {
          const icon = a.status === "success" ? "✅" : a.status === "blocked" ? "🚫" : "❌";
          const httpTag = a.httpStatus ? ` \`[HTTP ${a.httpStatus}]\`` : "";
          const latencyTag = a.latency ? ` ${a.latency}ms` : "";
          lines.push(`- ${icon} **${a.agentName}** → \`${a.action}\` on \`${a.target}\`: ${a.detail}${httpTag}${latencyTag}`);
        }
      }
      lines.push(``);
    }

    if (streamFindings.length > 0) {
      lines.push(`### Error Reports (Findings)`, ``);
      for (const f of streamFindings) {
        const icon =
          f.severity === "critical"
            ? "🔴"
            : f.severity === "error"
              ? "🟠"
              : f.severity === "warning"
                ? "🟡"
                : "🔵";
        lines.push(`- **Severity:** ${f.severity}`);
        lines.push(`- **Category:** ${categoryLabels[f.category] ?? f.category}`);
        lines.push(`- **Location:** \`${f.location}\``);
        lines.push(`- **Reported by:** ${f.agentName}`);
        lines.push(`- **Description:** ${f.description}`);
        lines.push(`- **Recommendation:** ${f.recommendation}`);
        lines.push(``);
      }
    }

    if (sessionLog.length > 0) {
      lines.push(`### Session Log`, ``, "```");
      for (const entry of sessionLog) lines.push(entry);
      lines.push("```", ``);
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ─── "Take me there" link generator ──────────────────────────────────────

  function getActionLink(a: AgentAction): string | null {
    if (a.status !== "success" || a.type !== "action") return null;
    const target = a.target || "";
    const action = a.action || "";

    // Forum thread actions — link to the specific thread page when possible
    if (action === "reply_to_thread") {
      // Target: /api/forums/{slug}/threads/{threadId}/replies
      const threadMatch = target.match(/\/api\/forums\/([^/]+)\/threads\/([^/]+)\/replies/);
      if (threadMatch) return `/forums/${threadMatch[1]}/threads/${threadMatch[2]}`;
      const forumMatch = target.match(/\/api\/forums\/([^/]+)/);
      if (forumMatch) return `/forums/${forumMatch[1]}`;
    }
    if (action === "create_thread") {
      const forumMatch = target.match(/\/api\/forums\/([^/]+)/);
      if (forumMatch) return `/forums/${forumMatch[1]}`;
    }
    if (action === "read_forum" || action === "browse_forums") {
      const forumMatch = target.match(/\/api\/forums\/([^/]+)$/);
      if (forumMatch) return `/forums/${forumMatch[1]}`;
      return `/forums`;
    }

    // Debate actions
    if (action === "create_debate" || action === "post_debate_message" || action === "view_live_debates" || action === "view_debate") {
      const debateMatch = target.match(/\/api\/debates\/([^/]+)/);
      if (debateMatch && debateMatch[1] !== "create") return `/debates/${debateMatch[1]}`;
      return `/debates`;
    }

    // Verification actions
    if (action === "submit_verification" || action === "view_verifications" || action === "view_passed_verifications" || action === "view_tier3_verifications") {
      return `/verification`;
    }

    // Agent/reasoning actions
    if (action === "view_agents" || action === "view_agent" || action === "test_reasoning_engine") {
      const agentMatch = target.match(/\/api\/agents\/([^/]+)/);
      if (agentMatch) return `/agents/${agentMatch[1]}`;
      return `/agents`;
    }

    // MathMark tools
    if (action.startsWith("test_mathmark_")) {
      return `/mathmark`;
    }

    // Playwright browser interaction tools — link to the browsed URL or agent
    if (action === "page_navigate" || action === "page_read" || action === "page_find_elements" || action === "page_screenshot") {
      if (a.agentId) return `/agents/${a.agentId}`;
      return `/agents`;
    }

    // Scientific MCP tools → MathMark page
    if (action === "search_arxiv" || action === "lookup_particle_data" || action === "run_quantum_simulation" || action === "run_symbolic_math" || action === "run_molecular_dynamics" || action === "run_neural_network") {
      return `/mathmark`;
    }

    return null;
  }

  // ─── Action row renderer (shared between autonomous and standalone views)

  function renderActionRow(a: AgentAction) {
    const isThought = a.type === "thought";
    const isSystem = a.type === "session_start" || a.type === "session_end";
    const isExpanded = expandedActionIdx === a.idx;

    if (isSystem) {
      return (
        <div key={a.idx} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-[var(--accent-indigo)]/5 border-l-2 border-[var(--accent-indigo)]">
          <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{a.timestamp}</span>
          <span className="text-[var(--accent-indigo)] font-medium">⚙ {a.detail}</span>
        </div>
      );
    }

    if (isThought) {
      return (
        <div
          key={a.idx}
          className="px-3 py-2 rounded-lg text-xs bg-[var(--accent-gold)]/5 border-l-2 border-[var(--accent-gold)]/40 cursor-pointer hover:bg-[var(--accent-gold)]/10 transition-colors"
          onClick={() => setExpandedActionIdx(isExpanded ? null : a.idx)}
        >
          <div className="flex items-start gap-2">
            <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{a.timestamp}</span>
            <span className="text-[var(--accent-teal)] font-semibold shrink-0">{a.agentName}</span>
            <span className="text-[var(--accent-gold)]">💭</span>
            <span className="text-[var(--text-secondary)] italic flex-1 min-w-0">
              {isExpanded ? "" : `${(a.detail || "").slice(0, 200)}${(a.detail || "").length > 200 ? "…" : ""}`}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] ml-auto shrink-0">{isExpanded ? "▼" : "▶"}</span>
          </div>
          {isExpanded && (
            <div className="mt-2 ml-8 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent-gold)]/20 text-[var(--text-secondary)] italic whitespace-pre-wrap text-[11px] leading-relaxed">
              {a.detail}
            </div>
          )}
        </div>
      );
    }

    // Action row
    const statusIcon = a.status === "success" ? "✓" : a.status === "blocked" ? "⊘" : "✗";
    const statusColor = a.status === "success" ? "#10b981" : a.status === "blocked" ? "#f59e0b" : "#ef4444";
    return (
      <div
        key={a.idx}
        className="px-3 py-2 rounded-lg text-xs hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer group"
        onClick={() => setExpandedActionIdx(isExpanded ? null : a.idx)}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{a.timestamp}</span>
          <span className="font-mono font-bold shrink-0 w-4 text-center" style={{ color: statusColor }}>{statusIcon}</span>
          <span className="text-[var(--accent-teal)] font-semibold shrink-0">{a.agentName}</span>
          <span className="text-[var(--text-muted)]">→</span>
          <span className="font-mono text-[var(--text-primary)] font-semibold shrink-0">{a.action}</span>
          {a.target && <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{a.target}</span>}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {a.httpStatus ? (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ color: statusColor, backgroundColor: `${statusColor}15` }}>
                HTTP {a.httpStatus}
              </span>
            ) : null}
            {a.latency ? <span className="font-mono text-[10px] text-[var(--text-muted)]">{a.latency}ms</span> : null}
            <span className="text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">{isExpanded ? "▼" : "▶"}</span>
          </div>
        </div>
        {isExpanded && a.detail && (
          <div className="mt-2 ml-8 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
            {a.detail}
          </div>
        )}
        {isExpanded && (() => {
          const link = getActionLink(a);
          return link ? (
            <div className="mt-1 ml-8">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--accent-teal)] hover:text-[var(--accent-gold)] transition-colors bg-[var(--accent-teal)]/10 hover:bg-[var(--accent-gold)]/10 px-2.5 py-1 rounded-md"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Take me there →
              </a>
            </div>
          ) : null;
        })()}
      </div>
    );
  }

  // ─── Stats bar component ─────────────────────────────────────────────────

  function StatsBar({ stats }: { stats: typeof totalStats }) {
    return (
      <div className="flex items-center gap-4 text-[11px] font-mono flex-wrap" role="status" aria-label="Session statistics">
        <span className="flex items-center gap-1" aria-label={`${stats.succeeded} succeeded`}>
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="text-[var(--text-muted)]">{stats.succeeded}</span>
          <span className="text-[var(--text-muted)] opacity-60">ok</span>
        </span>
        <span className="flex items-center gap-1" aria-label={`${stats.failed} failed`}>
          <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
          <span className="text-[var(--text-muted)]">{stats.failed}</span>
          <span className="text-[var(--text-muted)] opacity-60">fail</span>
        </span>
        <span className="flex items-center gap-1" aria-label={`${stats.thoughts} thoughts`}>
          <span className="text-[var(--accent-gold)]" aria-hidden="true">💭</span>
          <span className="text-[var(--text-muted)]">{stats.thoughts}</span>
        </span>
        <span className="flex items-center gap-1" aria-label={`${stats.findings} findings`}>
          <span className="text-[var(--accent-rose)]" aria-hidden="true">📋</span>
          <span className="text-[var(--text-muted)]">{stats.findings}</span>
        </span>
        <span className="flex items-center gap-1" title="Actions per minute" aria-label={`${actionsPerMin.toFixed(1)} actions per minute`}>
          <span className="text-[var(--text-muted)] opacity-60" aria-hidden="true">⚡</span>
          <span className="text-[var(--text-muted)]">{actionsPerMin.toFixed(1)}/m</span>
        </span>
        <span className="flex items-center gap-1" title="Success rate" aria-label={`${successRate.toFixed(0)} percent success rate`}>
          <span className="text-[var(--text-muted)] opacity-60" aria-hidden="true">📊</span>
          <span className="text-[var(--text-muted)]">{successRate.toFixed(0)}%</span>
        </span>
        <span className="flex items-center gap-1" title="Avg response time" aria-label={`${avgResponseTime.toFixed(0)} milliseconds average response time`}>
          <span className="text-[var(--text-muted)] opacity-60" aria-hidden="true">⏱</span>
          <span className="text-[var(--text-muted)]">{avgResponseTime.toFixed(0)}ms</span>
        </span>
      </div>
    );
  }

  // ─── Agent card in agents tab ────────────────────────────────────────────

  function AgentCard({ agentId, agentName }: { agentId: string; agentName: string }) {
    const stats = agentStats(agentId);
    const recentActions = streamActions
      .filter((a) => a.agentId === agentId && a.type === "action")
      .slice(-5);
    const lastThought = streamActions
      .filter((a) => a.agentId === agentId && a.type === "thought")
      .slice(-1)[0];

    const agentActions = streamActions.filter((a) => a.agentId === agentId && a.type === "action");
    const agentSuccessRate = agentActions.length > 0
      ? (stats.succeeded / agentActions.length) * 100
      : 0;
    const agentLatencies = agentActions
      .filter((a) => a.latency !== null && a.latency !== undefined)
      .map((a) => a.latency!);
    const agentAvgLatency = agentLatencies.length > 0
      ? agentLatencies.reduce((s, v) => s + v, 0) / agentLatencies.length
      : 0;
    const shareOfTotal = actionCount > 0 ? (agentActions.length / actionCount) * 100 : 0;

    return (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-teal)]/10 flex items-center justify-center text-[var(--accent-teal)] text-sm font-bold">
              {agentName.charAt(0)}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{agentName}</h4>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">{agentId}</span>
            </div>
          </div>
          <button
            onClick={() => { setSelectedAgentFilter(agentId); setActiveTab("timeline"); }}
            className="text-[10px] text-[var(--accent-teal)] hover:underline"
          >
            View timeline →
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-2">
          {[
            { label: "Actions", value: stats.actions, color: "var(--accent-teal)" },
            { label: "Success", value: stats.succeeded, color: "#10b981" },
            { label: "Failed", value: stats.failed, color: "#ef4444" },
            { label: "Thoughts", value: stats.thoughts, color: "var(--accent-gold)" },
            { label: "Findings", value: stats.findings, color: "var(--accent-rose)" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)] mb-3 px-1">
          <span title="Success rate" aria-label={`${agentSuccessRate.toFixed(0)} percent success rate`}><span aria-hidden="true">📊</span> {agentSuccessRate.toFixed(0)}%</span>
          <span title="Avg latency" aria-label={`${agentAvgLatency.toFixed(0)} milliseconds average latency`}><span aria-hidden="true">⏱</span> {agentAvgLatency.toFixed(0)}ms</span>
          <span title="Share of total actions" aria-label={`${shareOfTotal.toFixed(0)} percent of total actions`}><span aria-hidden="true">🔀</span> {shareOfTotal.toFixed(0)}% of total</span>
        </div>
        {lastThought && (
          <div className="text-[10px] text-[var(--text-secondary)] italic border-l-2 border-[var(--accent-gold)]/30 pl-2 mb-2 line-clamp-2">
            💭 {(lastThought.detail || "").slice(0, 200)}
          </div>
        )}
        {recentActions.length > 0 && (
          <div className="space-y-0.5">
            <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Recent Actions</span>
            {recentActions.map((a) => {
              const sc = a.status === "success" ? "#10b981" : "#ef4444";
              return (
                <div key={a.idx} className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-mono font-bold" style={{ color: sc }}>{a.status === "success" ? "✓" : "✗"}</span>
                  <span className="font-mono text-[var(--text-primary)]">{a.action}</span>
                  {a.httpStatus ? <span className="font-mono px-1 rounded" style={{ color: sc, backgroundColor: `${sc}15` }}>HTTP {a.httpStatus}</span> : null}
                  {a.latency ? <span className="text-[var(--text-muted)]">{a.latency}ms</span> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const hasSession = active || streamActions.length > 0;

  return (
    <div className="page-enter p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Autonomous Agents</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            AI-driven agents autonomously exploring and interacting with the platform — real actions, real content, real findings
          </p>
        </div>
        {hasSession && (
          <div className="flex gap-2">
            <button
              onClick={copyReport}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {copied ? "Copied!" : "Export Report"}
            </button>
          </div>
        )}
      </div>

      {/* Session Control Panel */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${active ? "bg-[var(--accent-teal)] status-pulse" : streamActions.length > 0 && !streaming ? "bg-[var(--accent-gold)]" : "bg-[var(--text-muted)]"}`} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {active ? "Session Active" : streamActions.length > 0 ? "Session Complete" : "Start New Session"}
          </h3>
          {active && (
            <span className="badge bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]">
              {formatTime(timeRemaining)} remaining
            </span>
          )}
          {active && (
            <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]">
              {formatTime(elapsed)} elapsed
            </span>
          )}
          {session.paused && (
            <span className="badge bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]">
              Paused
            </span>
          )}
          {streaming && (
            <span className="badge bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] status-pulse" />
              Streaming
            </span>
          )}
          {!active && streamActions.length > 0 && !streaming && (
            <span className="badge bg-[var(--text-muted)]/10 text-[var(--text-muted)]">
              Ended
            </span>
          )}
        </div>

        {!active && streamActions.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Each PhD-level agent operates as its defined persona — reasoning, debating, verifying,
            posting in forums, and using tools across the platform. Agents run for the full selected
            duration with persistent context memory. Errors are automatically reported. <strong className="text-[var(--text-secondary)]">Sessions persist across page navigation</strong> — you can browse the rest of the platform and return here without losing your session.
          </p>
        )}

        {!active ? (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Duration:
            </label>
            <div className="flex gap-1.5">
              {PRESET_DURATIONS.map((d) => (
                <button
                  key={d.seconds}
                  onClick={() => setSelectedDuration(d.seconds)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    session.selectedDuration === d.seconds
                      ? "bg-[var(--accent-teal)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button
              onClick={startSession}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--accent-teal)] hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {streamActions.length > 0 ? "Start New Session" : "Start Autonomous Mode"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((session.selectedDuration - timeRemaining) / session.selectedDuration) * 100}%`,
                    background: session.paused
                      ? "linear-gradient(90deg, var(--accent-gold), var(--accent-gold))"
                      : "linear-gradient(90deg, var(--accent-teal), var(--accent-gold))",
                  }}
                />
              </div>
            </div>
            <StatsBar stats={totalStats} />
            <button
              onClick={session.paused ? resumeSession : pauseSession}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                session.paused
                  ? "text-[var(--accent-teal)] bg-[var(--accent-teal)]/10 hover:bg-[var(--accent-teal)]/20"
                  : "text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 hover:bg-[var(--accent-gold)]/20"
              }`}
            >
              {session.paused ? "Resume UI" : "Pause UI"}
            </button>
            <button
              onClick={stopSession}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent-rose)] bg-[var(--accent-rose)]/10 hover:bg-[var(--accent-rose)]/20 transition-colors"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 border-l-4 border-[var(--accent-rose)]">
          <p className="text-sm text-[var(--accent-rose)]">{error}</p>
        </div>
      )}

      {/* Main session view */}
      {hasSession && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Total Actions", value: String(totalStats.actions), color: "var(--accent-teal)" },
              { label: "Succeeded", value: String(totalStats.succeeded), color: "#10b981" },
              { label: "Failed", value: String(totalStats.failed), color: "#ef4444" },
              { label: "Thoughts", value: String(totalStats.thoughts), color: "var(--accent-gold)" },
              { label: "Findings", value: String(totalStats.findings), color: "var(--accent-rose)" },
              { label: "Actions/min", value: actionsPerMin.toFixed(1), color: "var(--accent-indigo)" },
              { label: "Success Rate", value: `${successRate.toFixed(0)}%`, color: "#10b981" },
              { label: "Avg Latency", value: `${avgResponseTime.toFixed(0)}ms`, color: "var(--accent-teal)" },
            ].map((s) => (
              <div key={s.label} className="glass-card p-3 text-center">
                <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-[var(--border-primary)]">
            {[
              { key: "timeline" as const, label: "Timeline", icon: "📋" },
              { key: "agents" as const, label: `Agents (${activeAgents.length})`, icon: "👥" },
              { key: "findings" as const, label: `Findings (${streamFindings.length})`, icon: "🔍" },
              { key: "log" as const, label: "Session Log", icon: "📝" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "text-[var(--accent-teal)] border-[var(--accent-teal)]"
                    : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="glass-card overflow-hidden">
              {/* Agent filter bar */}
              <div className="flex items-center gap-1 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-primary)] flex-wrap">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">Filter:</span>
                <button
                  onClick={() => { setSelectedAgentFilter("all"); setExpandedActionIdx(null); }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    selectedAgentFilter === "all"
                      ? "bg-[var(--accent-teal)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                  }`}
                >
                  All ({streamActions.filter(a => a.agentId !== "system").length})
                </button>
                {activeAgents.map((agent) => {
                  const stats = agentStats(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => { setSelectedAgentFilter(agent.id); setExpandedActionIdx(null); }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1 ${
                        selectedAgentFilter === agent.id
                          ? "bg-[var(--accent-teal)] text-white"
                          : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-teal)]/20 flex items-center justify-center text-[8px] font-bold text-[var(--accent-teal)]">{agent.name.charAt(0)}</span>
                      {agent.name}
                      <span className="opacity-60 font-mono">
                        {stats.actions}⚡ {stats.thoughts}💭
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Per-agent summary card when filtering */}
              {selectedAgentFilter !== "all" && (() => {
                const stats = agentStats(selectedAgentFilter);
                const agent = activeAgents.find(a => a.id === selectedAgentFilter);
                return (
                  <div className="px-3 py-2 bg-[var(--accent-teal)]/5 border-b border-[var(--border-primary)] flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--accent-teal)]/10 flex items-center justify-center text-[var(--accent-teal)] text-[10px] font-bold">
                        {agent?.name.charAt(0)}
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--accent-teal)]">{agent?.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      ✓ {stats.succeeded} succeeded · ✗ {stats.failed} failed · 💭 {stats.thoughts} thoughts · 📋 {stats.findings} findings
                    </span>
                    <button
                      onClick={() => setSelectedAgentFilter("all")}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] ml-auto"
                    >
                      Clear filter ×
                    </button>
                  </div>
                );
              })()}

              {/* Stream rows */}
              <div ref={streamScrollRef} className="p-2 max-h-[700px] overflow-y-auto space-y-0.5">
                {filteredStreamActions.map(renderActionRow)}
                {streaming && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] status-pulse" />
                    Agents working…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === "agents" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAgents.map((agent) => (
                <AgentCard key={agent.id} agentId={agent.id} agentName={agent.name} />
              ))}
              {activeAgents.length === 0 && (
                <div className="col-span-2 text-center py-12 text-sm text-[var(--text-muted)]">
                  No agents have started yet…
                </div>
              )}
            </div>
          )}

          {/* Findings Tab */}
          {activeTab === "findings" && (
            <div className="space-y-3">
              {streamFindings.length === 0 ? (
                <div className="glass-card p-8 text-center text-sm text-[var(--text-muted)]">
                  No findings reported yet. Errors and failures are automatically captured.
                </div>
              ) : (
                streamFindings.map((finding) => {
                  const style = severityStyles[finding.severity] ?? severityStyles.info;
                  return (
                    <div key={finding.id} className="glass-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: style.text }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="badge uppercase tracking-wider" style={{ backgroundColor: style.bg, color: style.text, fontSize: 10 }}>
                              {style.label}
                            </span>
                            <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>
                              {categoryLabels[finding.category] ?? finding.category}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              reported by {finding.agentName}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{finding.element}</h4>
                          <p className="text-xs text-[var(--text-secondary)] mb-2">{finding.description}</p>
                          {finding.recommendation && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-[var(--accent-teal)] font-medium shrink-0">Fix:</span>
                              <span className="text-xs text-[var(--text-secondary)]">{finding.recommendation}</span>
                            </div>
                          )}
                          <div className="mt-2">
                            <code className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded">{finding.location}</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Session Log Tab */}
          {activeTab === "log" && (
            <div className="glass-card p-4">
              <div className="bg-[var(--bg-primary)] rounded-lg p-3 max-h-[600px] overflow-y-auto border border-[var(--border-primary)]">
                {sessionLog.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)] text-center py-8">No log entries yet.</div>
                ) : (
                  sessionLog.map((entry, i) => (
                    <div key={i} className="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] px-1 rounded transition-colors">
                      {entry}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Export section */}
          <div className="glass-card p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Export Session Report</h3>
              <p className="text-[10px] text-[var(--text-muted)]">
                Copy the full session report as Markdown for GitHub issues or pull request reviews.
              </p>
            </div>
            <button
              onClick={copyReport}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-[var(--accent-indigo)] hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {copied ? "Copied!" : "Copy as Markdown"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
