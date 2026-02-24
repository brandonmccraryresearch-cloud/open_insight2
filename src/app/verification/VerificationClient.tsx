"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/data/agents";
import type { VerificationEntry } from "@/data/verifications";

const tierInfo = {
  "Tier 1": { label: "Dimensional", tool: "Pint", color: "#10b981", speed: "<10ms", description: "Fast dimensional consistency checks" },
  "Tier 2": { label: "Symbolic", tool: "SymPy/Cadabra", color: "#f59e0b", speed: "<1s", description: "Symbolic algebra verification" },
  "Tier 3": { label: "Formal Proof", tool: "Lean 4", color: "#8b5cf6", speed: "1-60s", description: "Machine-checked formal proofs" },
};

const tierTools: Record<string, string> = {
  "Tier 1": "Pint (dimensional)",
  "Tier 2": "SymPy (symbolic)",
  "Tier 3": "Lean 4 (formal)",
};

const statusStyle = {
  passed: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Passed" },
  failed: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Failed" },
  running: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Running" },
  queued: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Queued" },
};

export default function VerificationClient({
  verifications,
  agents,
}: {
  verifications: VerificationEntry[];
  agents: Agent[];
}) {
  const router = useRouter();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilterVal, setStatusFilterVal] = useState<string>("all");
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitClaim, setSubmitClaim] = useState("");
  const [submitTier, setSubmitTier] = useState("Tier 1");
  const [submitAgent, setSubmitAgent] = useState(agents[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  async function handleSubmitVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!submitClaim.trim() || !submitAgent) return;
    setSubmitting(true);

    const res = await fetch("/api/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: submitClaim.trim(),
        tier: submitTier,
        tool: tierTools[submitTier] ?? submitTier,
        agentId: submitAgent,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setSubmitClaim("");
      setShowSubmit(false);
      // Start streaming verification progress
      if (data.verification?.id) {
        streamVerification(data.verification.id);
      }
      router.refresh();
    }
    setSubmitting(false);
  }

  async function streamVerification(id: string) {
    setStreamingId(id);
    setStreamStatus("Queued...");
    try {
      const res = await fetch(`/api/verifications/${id}/stream`);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const payload = line.slice(6);
          if (payload === "[DONE]") {
            setStreamingId(null);
            setStreamStatus(null);
            router.refresh();
            return;
          }
          try {
            const data = JSON.parse(payload);
            setStreamStatus(`${data.status}: ${data.details}`);
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setStreamingId(null);
      setStreamStatus(null);
    }
  }

  const filtered = verifications.filter((v) => {
    if (tierFilter !== "all" && v.tier !== tierFilter) return false;
    if (statusFilterVal !== "all" && v.status !== statusFilterVal) return false;
    return true;
  });

  const completedCount = verifications.filter((v) => v.status !== "queued" && v.status !== "running").length;
  const passRate = completedCount > 0 ? Math.round((verifications.filter((v) => v.status === "passed").length / completedCount) * 100) : 0;

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verification Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)]">Three-tier verification pipeline: Dimensional Analysis &rarr; Symbolic Algebra &rarr; Formal Proof</p>
        </div>
        <button onClick={() => setShowSubmit(!showSubmit)} className="btn-primary">
          {showSubmit ? "Cancel" : "Submit Claim"}
        </button>
      </div>

      {showSubmit && (
        <form onSubmit={handleSubmitVerification} className="glass-card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Claim to Verify</label>
            <textarea
              value={submitClaim}
              onChange={(e) => setSubmitClaim(e.target.value)}
              placeholder="e.g., Decoherence timescale for macroscopic objects: t_D ~ 10^-20 s"
              required
              rows={2}
              className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-teal)] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Verification Tier</label>
              <select
                value={submitTier}
                onChange={(e) => setSubmitTier(e.target.value)}
                className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="Tier 1">Tier 1: Dimensional (Pint)</option>
                <option value="Tier 2">Tier 2: Symbolic (SymPy)</option>
                <option value="Tier 3">Tier 3: Formal Proof (Lean 4)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Submitting Agent</label>
              <select
                value={submitAgent}
                onChange={(e) => setSubmitAgent(e.target.value)}
                className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting || !submitClaim.trim()} className="btn-primary disabled:opacity-50">
            {submitting ? "Submitting..." : "Queue for Verification"}
          </button>
        </form>
      )}

      {streamingId && streamStatus && (
        <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-[var(--accent-amber)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-amber)] status-pulse" />
          <span className="text-sm text-[var(--text-secondary)]">{streamStatus}</span>
        </div>
      )}

      {/* Tier Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(tierInfo).map(([tier, info]) => {
          const count = verifications.filter((v) => v.tier === tier).length;
          const passed = verifications.filter((v) => v.tier === tier && v.status === "passed").length;
          return (
            <div key={tier} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: info.color }}>{tier}: {info.label}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{info.tool} | {info.speed}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono" style={{ color: info.color }}>{passed}/{count}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">passed</div>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{info.description}</p>
              <div className="progress-bar mt-3">
                <div className="progress-fill" style={{ width: `${count > 0 ? (passed / count) * 100 : 0}%`, backgroundColor: info.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall stats */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-2xl font-bold font-mono text-[var(--accent-emerald)]">{passRate}%</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">Pass Rate</span>
          </div>
          <div>
            <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">{verifications.length}</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">Total Checks</span>
          </div>
          <div>
            <span className="text-2xl font-bold font-mono text-[var(--accent-indigo)]">{verifications.filter((v) => v.tier === "Tier 3" && v.status === "passed").length}</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">Lean 4 Proofs</span>
          </div>
        </div>
        <div className="flex gap-2">
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none">
            <option value="all">All Tiers</option>
            <option value="Tier 1">Tier 1: Dimensional</option>
            <option value="Tier 2">Tier 2: Symbolic</option>
            <option value="Tier 3">Tier 3: Formal</option>
          </select>
          <select value={statusFilterVal} onChange={(e) => setStatusFilterVal(e.target.value)} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none">
            <option value="all">All Status</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
          </select>
        </div>
      </div>

      {/* Verification entries */}
      <div className="space-y-3">
        {filtered
          .filter((v) => agentMap.has(v.agentId))
          .map((v) => {
          const agent = agentMap.get(v.agentId)!;
          const tier = tierInfo[v.tier];
          const st = statusStyle[v.status];
          return (
            <div key={v.id} className="glass-card p-4">
              <div className="flex items-start gap-4">
                <div className="agent-avatar" style={{ backgroundColor: agent.color, width: 36, height: 36, fontSize: 14 }}>{agent.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge" style={{ backgroundColor: `color-mix(in srgb, ${tier.color} 15%, transparent)`, color: tier.color, fontSize: 10 }}>{v.tier}</span>
                    <span className="badge" style={{ backgroundColor: st.bg, color: st.text, fontSize: 10 }}>
                      {v.status === "running" && <span className="w-1.5 h-1.5 rounded-full inline-block mr-1 status-pulse" style={{ backgroundColor: st.text }} />}
                      {st.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{v.tool}</span>
                    <span className="text-xs text-[var(--text-muted)]">{v.duration}</span>
                    {v.confidence !== undefined && (
                      <span className="text-xs font-mono" style={{ color: v.confidence >= 90 ? "#10b981" : v.confidence >= 70 ? "#f59e0b" : "#ef4444" }}>
                        {v.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{v.claim}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{v.details}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
                    <span>by {agent.name}</span>
                    <span>{v.timestamp}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
