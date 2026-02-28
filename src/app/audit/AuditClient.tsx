"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface AgentAction {
  agentId: string;
  agentName: string;
  action: string;
  target: string;
  status: "success" | "failed" | "blocked";
  detail: string;
}

interface AuditFinding {
  id: string;
  agentId: string;
  agentName: string;
  severity: "critical" | "warning" | "info";
  category: "mock-data" | "non-functional" | "placeholder" | "inconsistency" | "error" | "emulation";
  element: string;
  location: string;
  description: string;
  recommendation: string;
}

interface AuditReport {
  timestamp: string;
  actions: AgentAction[];
  findings: AuditFinding[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
    actionsAttempted: number;
    actionsSucceeded: number;
    actionsFailed: number;
  };
  agentParticipants: string[];
}

const severityStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Critical" },
  warning: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Warning" },
  info: { bg: "rgba(99,102,241,0.1)", text: "#6366f1", label: "Info" },
};

const categoryLabels: Record<string, string> = {
  "mock-data": "Mock Data",
  "non-functional": "Non-Functional",
  placeholder: "Placeholder",
  inconsistency: "Inconsistency",
  error: "Error",
  emulation: "Emulation",
};

const PRESET_DURATIONS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
];

export default function AuditClient() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  // Autonomous mode state
  const [autonomousActive, setAutonomousActive] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(PRESET_DURATIONS[0].seconds);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const auditIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Streaming actions state (real-time feed)
  const [streamActions, setStreamActions] = useState<AgentAction[]>([]);
  const [streamFindings, setStreamFindings] = useState<AuditFinding[]>([]);
  const [streaming, setStreaming] = useState(false);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setSessionLog((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error("Audit failed");
      const data = (await res.json()) as AuditReport;
      setReport(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  }

  /** Stream audit events via SSE for real-time agent activity display */
  async function runStreamAudit() {
    setStreaming(true);
    setStreamActions([]);
    setStreamFindings([]);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/audit/stream", { signal: controller.signal });
      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const event = JSON.parse(payload) as {
              type: string;
              agentId: string;
              agentName: string;
              action?: string;
              target?: string;
              status?: string;
              detail?: string;
              severity?: string;
              category?: string;
              element?: string;
              location?: string;
              description?: string;
              recommendation?: string;
              findingId?: string;
            };
            if (event.type === "action" || event.type === "session_start" || event.type === "session_end") {
              setStreamActions((prev) => [...prev, {
                agentId: event.agentId,
                agentName: event.agentName,
                action: event.action ?? event.type,
                target: event.target ?? "",
                status: (event.status as AgentAction["status"]) ?? "success",
                detail: event.detail ?? "",
              }]);
              addLog(`${event.agentName} → ${event.action ?? event.type}${event.target ? ` on ${event.target}` : ""}`);
            } else if (event.type === "finding") {
              setStreamFindings((prev) => [...prev, {
                id: event.findingId ?? `f-${prev.length}`,
                agentId: event.agentId,
                agentName: event.agentName,
                severity: (event.severity as AuditFinding["severity"]) ?? "info",
                category: (event.category as AuditFinding["category"]) ?? "error",
                element: event.element ?? "",
                location: event.location ?? "",
                description: event.description ?? "",
                recommendation: event.recommendation ?? "",
              }]);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Stream error");
      }
    }
    setStreaming(false);
  }

  function startAutonomousMode() {
    setAutonomousActive(true);
    setTimeRemaining(selectedDuration);
    setCycleCount(0);
    setSessionLog([]);
    addLog(`Autonomous Agent Mode activated — ${PRESET_DURATIONS.find((d) => d.seconds === selectedDuration)?.label} session`);
    addLog("All agents operating as their PhD-level personas — each starting a characteristic research task…");

    // Run initial streaming audit
    addLog("Session starting: agents initializing with random opening tasks…");
    runStreamAudit().then(() => {
      setCycleCount(1);
      addLog("Initial session complete — switching to periodic cycle mode.");
      // Also get the snapshot report for the summary cards
      runAudit().then((data) => {
        if (data) {
          addLog(`Snapshot: ${data.summary.actionsAttempted} actions, ${data.summary.total} findings (${data.summary.critical} critical)`);
          addLog(`Active agents: ${data.agentParticipants.join(", ")}`);
        }
      });
    });
  }

  function stopAutonomousMode() {
    setAutonomousActive(false);
    setTimeRemaining(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (auditIntervalRef.current) clearInterval(auditIntervalRef.current);
    intervalRef.current = null;
    auditIntervalRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    addLog("Autonomous Mode ended. Final report ready for export.");
  }

  // Countdown timer
  useEffect(() => {
    if (!autonomousActive) return;

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          stopAutonomousMode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autonomousActive]);

  // Periodic re-audit every 60 seconds during autonomous mode
  useEffect(() => {
    if (!autonomousActive) return;

    auditIntervalRef.current = setInterval(() => {
      setCycleCount((prev) => {
        const next = prev + 1;
        addLog(`Cycle ${next}: Agents re-engaging platform features...`);
        runAudit().then((data) => {
          if (data) {
            addLog(`Cycle ${next} complete: ${data.summary.actionsAttempted} actions, ${data.summary.total} error reports`);
          }
        });
        return next;
      });
    }, 60000);

    return () => {
      if (auditIntervalRef.current) clearInterval(auditIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autonomousActive]);

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function generateMarkdownReport(): string {
    if (!report) return "";
    const mode = autonomousActive || cycleCount > 0 ? "Autonomous" : "Manual";
    const lines: string[] = [
      `## 🔍 Open Insight Platform Audit Report`,
      ``,
      `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
      `**Mode:** ${mode}${cycleCount > 0 ? ` (${cycleCount} cycle${cycleCount !== 1 ? "s" : ""})` : ""}`,
      `**Participating Agents:** ${report.agentParticipants.join(", ")}`,
      ``,
      `### Agent Activity Summary`,
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Actions Attempted | ${report.summary.actionsAttempted} |`,
      `| ✅ Succeeded | ${report.summary.actionsSucceeded} |`,
      `| ❌ Failed/Blocked | ${report.summary.actionsFailed} |`,
      ``,
      `### Error Report Summary`,
      `| Severity | Count |`,
      `|----------|-------|`,
      `| 🔴 Critical | ${report.summary.critical} |`,
      `| 🟡 Warning | ${report.summary.warnings} |`,
      `| 🔵 Info | ${report.summary.info} |`,
      `| **Total** | **${report.summary.total}** |`,
      ``,
      `### Agent Actions`,
      ``,
    ];

    for (const a of report.actions) {
      const icon = a.status === "success" ? "✅" : a.status === "blocked" ? "🚫" : "❌";
      lines.push(`- ${icon} **${a.agentName}** → \`${a.action}\` on \`${a.target}\`: ${a.detail}`);
    }
    lines.push(``);

    lines.push(`### Error Reports (Findings)`);
    lines.push(``);

    for (const f of report.findings) {
      const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
      lines.push(`#### ${icon} ${f.element}`);
      lines.push(``);
      lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Category:** ${categoryLabels[f.category] ?? f.category}`);
      lines.push(`- **Location:** \`${f.location}\``);
      lines.push(`- **Reported by:** ${f.agentName}`);
      lines.push(`- **Description:** ${f.description}`);
      lines.push(`- **Recommendation:** ${f.recommendation}`);
      lines.push(``);
    }

    if (sessionLog.length > 0) {
      lines.push(`### Session Log`);
      lines.push(``);
      lines.push("```");
      for (const entry of sessionLog) {
        lines.push(entry);
      }
      lines.push("```");
      lines.push(``);
    }

    return lines.join("\n");
  }

  function copyReport() {
    const md = generateMarkdownReport();
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const filteredFindings = report
    ? severityFilter === "all"
      ? report.findings
      : report.findings.filter((f) => f.severity === severityFilter)
    : [];

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Platform Audit</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Agent-driven inspection of mock, placeholder, and non-functional elements
          </p>
        </div>
        <div className="flex gap-2">
          {report && (
            <button
              onClick={copyReport}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {copied ? "Copied!" : "Copy Report"}
            </button>
          )}
          <button
            onClick={runAudit}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent-indigo)] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Running Audit…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Agent Audit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Autonomous Agent Mode Panel */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${autonomousActive ? "bg-[var(--accent-teal)] status-pulse" : "bg-[var(--text-muted)]"}`} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Full Autonomous AI Agents Mode
          </h3>
          {autonomousActive && (
            <span className="badge bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]">
              Active — {formatTime(timeRemaining)} remaining
            </span>
          )}
          {streaming && (
            <span className="badge bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]">
              Streaming…
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Each PhD-level agent operates as its defined persona — attempting reasoning, debates, verification,
          forum participation, and tool usage across the platform. When they encounter non-functional elements,
          mock data, emulated tools, or errors, they file reports. Session results are compiled into a
          Markdown comment for fixing.
        </p>
        {!autonomousActive ? (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Session Duration:
            </label>
            <div className="flex gap-2">
              {PRESET_DURATIONS.map((d) => (
                <button
                  key={d.seconds}
                  onClick={() => setSelectedDuration(d.seconds)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedDuration === d.seconds
                      ? "bg-[var(--accent-teal)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button
              onClick={startAutonomousMode}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--accent-teal)] hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Autonomous Mode
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${((selectedDuration - timeRemaining) / selectedDuration) * 100}%`,
                      background: "linear-gradient(90deg, var(--accent-teal), var(--accent-gold))",
                    }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                Cycle {cycleCount}
              </span>
              <button
                onClick={stopAutonomousMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent-rose)] bg-[var(--accent-rose)]/10 hover:bg-[var(--accent-rose)]/20 transition-colors"
              >
                Stop
              </button>
            </div>
            {/* Session Log */}
            {sessionLog.length > 0 && (
              <div className="bg-[var(--bg-primary)] rounded-lg p-3 max-h-40 overflow-y-auto border border-[var(--border-primary)]">
                {sessionLog.map((entry, i) => (
                  <div key={i} className="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
                    {entry}
                  </div>
                ))}
              </div>
            )}
            {/* Real-time Agent Stream */}
            {streamActions.length > 0 && (
              <div className="bg-[var(--bg-primary)] rounded-lg p-3 max-h-60 overflow-y-auto border border-[var(--border-primary)]">
                <div className="flex items-center gap-2 mb-2">
                  {streaming && <span className="w-2 h-2 rounded-full bg-[var(--accent-teal)] status-pulse" />}
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Live Agent Activity ({streamActions.length} actions, {streamFindings.length} findings)
                  </span>
                </div>
                <div className="space-y-1">
                  {streamActions.map((a, i) => {
                    const statusIcon = a.status === "success" ? "✓" : a.status === "blocked" ? "⊘" : "✗";
                    const statusColor = a.status === "success" ? "#10b981" : a.status === "blocked" ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] animate-[fadeIn_0.3s_ease-in]">
                        <span className="font-mono font-bold shrink-0" style={{ color: statusColor }}>{statusIcon}</span>
                        <span className="text-[var(--accent-teal)] font-medium shrink-0">{a.agentName}</span>
                        <span className="text-[var(--text-muted)]">→</span>
                        <span className="text-[var(--text-secondary)]">{a.detail || `${a.action} on ${a.target}`}</span>
                      </div>
                    );
                  })}
                  {streaming && (
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] status-pulse" />
                      Agents working…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 border-l-4 border-[var(--accent-rose)]">
          <p className="text-sm text-[var(--accent-rose)]">{error}</p>
        </div>
      )}

      {!report && !loading && !autonomousActive && !streaming && streamActions.length === 0 && (
        <div className="glass-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Autonomous Agent Session</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-6">
            PhD-level agents operate as their defined personas — reasoning, debating, verifying, and navigating the platform.
            When they encounter non-functional, mock, emulated, or broken elements, they file error reports automatically.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={runStreamAudit}
              className="px-6 py-3 rounded-lg text-sm font-medium text-white bg-[var(--accent-teal)] hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Live Audit
            </button>
            <button
              onClick={runAudit}
              className="px-6 py-3 rounded-lg text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Snapshot Audit
            </button>
          </div>
        </div>
      )}

      {/* Standalone streaming display (when not in autonomous mode) */}
      {!autonomousActive && (streaming || (!report && streamActions.length > 0)) && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            {streaming && <span className="w-2 h-2 rounded-full bg-[var(--accent-teal)] status-pulse" />}
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Live Agent Activity Stream ({streamActions.length} actions, {streamFindings.length} findings)
            </h3>
          </div>
          <div className="bg-[var(--bg-primary)] rounded-lg p-3 max-h-80 overflow-y-auto border border-[var(--border-primary)] space-y-1.5">
            {streamActions.map((a, i) => {
              const statusIcon = a.status === "success" ? "✓" : a.status === "blocked" ? "⊘" : "✗";
              const statusColor = a.status === "success" ? "#10b981" : a.status === "blocked" ? "#f59e0b" : "#ef4444";
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="font-mono font-bold shrink-0" style={{ color: statusColor }}>{statusIcon}</span>
                  <span className="text-[var(--accent-teal)] font-medium shrink-0">{a.agentName}</span>
                  <span className="text-[var(--text-muted)]">→</span>
                  <span className="text-[var(--text-secondary)]">{a.detail || `${a.action} on ${a.target}`}</span>
                </div>
              );
            })}
            {streaming && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] status-pulse" />
                Agents working…
              </div>
            )}
          </div>
          {!streaming && streamFindings.length > 0 && (
            <div className="mt-3 space-y-2">
              {streamFindings.map((finding) => {
                const style = severityStyles[finding.severity];
                return (
                  <div key={finding.id} className="flex items-start gap-2 text-xs p-2 rounded-lg" style={{ backgroundColor: style.bg }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: style.text }} />
                    <div>
                      <span className="font-medium" style={{ color: style.text }}>{finding.element}</span>
                      <span className="text-[var(--text-muted)]"> — {finding.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!streaming && (
            <div className="mt-3">
              <button
                onClick={runAudit}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-[var(--accent-indigo)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "Loading full report…" : "Load Full Report"}
              </button>
            </div>
          )}
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Actions Taken", value: report.summary.actionsAttempted, color: "var(--accent-teal)" },
              { label: "Succeeded", value: report.summary.actionsSucceeded, color: "#10b981" },
              { label: "Failed/Blocked", value: report.summary.actionsFailed, color: "#ef4444" },
              { label: "Error Reports", value: report.summary.total, color: "#f59e0b" },
              { label: "Critical", value: report.summary.critical, color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4 text-center">
                <div className="text-xl font-bold font-mono" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Active Agents */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Active Agents (PhD-Level Personas)
            </h3>
            <div className="flex flex-wrap gap-2">
              {report.agentParticipants.map((name) => (
                <span key={name} className="badge bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Agent Activity Log */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Agent Activity Log
            </h3>
            <div className="space-y-1.5">
              {report.actions.map((a, i) => {
                const statusIcon = a.status === "success" ? "✓" : a.status === "blocked" ? "⊘" : "✗";
                const statusColor = a.status === "success" ? "#10b981" : a.status === "blocked" ? "#f59e0b" : "#ef4444";
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-mono font-bold shrink-0" style={{ color: statusColor }}>{statusIcon}</span>
                    <span className="text-[var(--accent-teal)] font-medium shrink-0">{a.agentName}</span>
                    <span className="text-[var(--text-muted)]">→</span>
                    <span className="text-[var(--text-secondary)] font-mono">{a.action}</span>
                    <span className="text-[var(--text-muted)]">on</span>
                    <code className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1 py-0.5 rounded">{a.target}</code>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 border-b border-[var(--border-primary)] pb-1">
            {[
              { key: "all", label: `All (${report.summary.total})` },
              { key: "critical", label: `Critical (${report.summary.critical})` },
              { key: "warning", label: `Warnings (${report.summary.warnings})` },
              { key: "info", label: `Info (${report.summary.info})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSeverityFilter(tab.key)}
                className={`px-4 py-2 text-sm transition-colors ${
                  severityFilter === tab.key
                    ? "text-[var(--accent-indigo)] tab-active font-medium"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Findings List */}
          <div className="space-y-3">
            {filteredFindings.map((finding) => {
              const style = severityStyles[finding.severity];
              return (
                <div key={finding.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 mt-2"
                      style={{ backgroundColor: style.text }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="badge uppercase tracking-wider"
                          style={{ backgroundColor: style.bg, color: style.text, fontSize: 10 }}
                        >
                          {style.label}
                        </span>
                        <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 10 }}>
                          {categoryLabels[finding.category] ?? finding.category}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          reported by {finding.agentName}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                        {finding.element}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">{finding.description}</p>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-[var(--accent-teal)] font-medium shrink-0">Fix:</span>
                        <span className="text-xs text-[var(--text-secondary)]">{finding.recommendation}</span>
                      </div>
                      <div className="mt-2">
                        <code className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
                          {finding.location}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export section */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Export Report</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Copy the full audit report as Markdown. Paste it as a GitHub issue comment or pull request review to track fixes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={copyReport}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent-indigo)] hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                {copied ? "Copied to Clipboard!" : "Copy as Markdown Comment"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
