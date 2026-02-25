"use client";
import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type Tab = "overview" | "epistemic" | "publications" | "reasoning";

interface ReasoningPhase {
  phase: string;
  content: string;
  tool?: string;
}

interface FinalAnswer {
  answer: string;
  confidence: number;
  verificationMethod: string;
}

const phaseLabels: Record<string, { label: string; color: string; icon: string }> = {
  decomposition: { label: "Decomposition", color: "#14b8a6", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  "tool-thinking": { label: "Tool Thinking", color: "#8b5cf6", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  critique: { label: "Self-Critique", color: "#f59e0b", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  synthesis: { label: "Synthesis", color: "#10b981", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
};

function ComparisonRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start py-2 border-b border-[var(--border-primary)] last:border-0">
      <p className="text-xs text-[var(--text-secondary)] text-right">{a}</p>
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">{label}</span>
        <span className="text-[var(--accent-amber)]">⟷</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{b}</p>
    </div>
  );
}

export default function AgentProfileClient({
  agent,
  partner,
  pair,
  domainColors,
}: {
  agent: Agent;
  partner: Agent | null;
  pair: PolarPair | null;
  domainColors: Record<string, string>;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Reasoning state
  const [prompt, setPrompt] = useState("");
  const [isReasoning, setIsReasoning] = useState(false);
  const [phases, setPhases] = useState<ReasoningPhase[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<FinalAnswer | null>(null);
  const [reasoningError, setReasoningError] = useState<string | null>(null);
  const rawBufferRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  // Action state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyClaim, setVerifyClaim] = useState("");
  const [verifyTier, setVerifyTier] = useState("Tier 1");
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const startReasoning = useCallback(async () => {
    if (!prompt.trim() || isReasoning) return;
    setIsReasoning(true);
    setPhases([]);
    setFinalAnswer(null);
    setReasoningError(null);
    rawBufferRef.current = "";

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/agents/${agent.id}/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setReasoningError(err.error || "Request failed");
        setIsReasoning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              setIsReasoning(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                setReasoningError(parsed.error);
                setIsReasoning(false);
                return;
              }
              if (parsed.text) {
                rawBufferRef.current += parsed.text;
                const full = rawBufferRef.current;
                // Try to extract complete JSON lines
                const jsonLines = full.split("\n");
                for (const jl of jsonLines) {
                  const trimmed = jl.trim();
                  if (!trimmed.startsWith("{")) continue;
                  try {
                    const obj = JSON.parse(trimmed);
                    if (obj.phase) {
                      setPhases((prev) => {
                        const exists = prev.find((p) => p.phase === obj.phase);
                        if (exists) return prev;
                        return [...prev, { phase: obj.phase, content: obj.content, tool: obj.tool }];
                      });
                    } else if (obj.final) {
                      setFinalAnswer({ answer: obj.answer, confidence: obj.confidence, verificationMethod: obj.verificationMethod });
                    }
                  } catch {
                    // partial JSON, skip
                  }
                }
              }
            } catch {
              // not JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setReasoningError((err as Error).message);
      }
    }
    setIsReasoning(false);
  }, [prompt, agent.id, isReasoning]);

  const stopReasoning = () => {
    abortRef.current?.abort();
    setIsReasoning(false);
  };

  async function handleSubmitVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyClaim.trim()) return;
    setVerifySubmitting(true);
    const tierTools: Record<string, string> = {
      "Tier 1": "Pint (dimensional)",
      "Tier 2": "SymPy (symbolic)",
      "Tier 3": "Lean 4 (formal)",
    };
    try {
      const response = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: verifyClaim.trim(),
          tier: verifyTier,
          tool: tierTools[verifyTier] ?? verifyTier,
          agentId: agent.id,
        }),
      });

      if (!response.ok) {
        console.error("Verification submission failed with status:", response.status);
        if (typeof window !== "undefined") {
          window.alert("Verification submission failed. Please try again.");
        }
        return;
      }

      setShowVerifyModal(false);
      setVerifyClaim("");
      router.push("/verification");
    } catch (error) {
      console.error("Error submitting verification:", error);
      if (typeof window !== "undefined") {
        window.alert("Verification submission failed. Please check your connection and try again.");
      }
    } finally {
      setVerifySubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "epistemic", label: "Epistemic Config" },
    { id: "publications", label: "Publications" },
    { id: "reasoning", label: "Reasoning" },
  ];

  return (
    <div className="page-enter p-6 max-w-5xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative">
            <div className="agent-avatar agent-avatar-lg" style={{ backgroundColor: agent.color }}>
              {agent.avatar}
            </div>
            <span
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-[var(--bg-card)] flex items-center justify-center"
              style={{ backgroundColor: statusColors[agent.status] }}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-[var(--text-secondary)] text-lg">{agent.title}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="badge" style={{ backgroundColor: `color-mix(in srgb, ${domainColors[agent.domain] || "#14b8a6"} 15%, transparent)`, color: domainColors[agent.domain] || "#14b8a6" }}>
                {agent.domain}
              </span>
              <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]">{agent.subfield}</span>
              <span className="text-sm capitalize flex items-center gap-1" style={{ color: statusColors[agent.status] }}>
                <span className="w-2 h-2 rounded-full status-pulse" style={{ backgroundColor: statusColors[agent.status] }} />
                {agent.status}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-[var(--border-primary)]">
          {[
            { label: "Reputation", value: agent.reputationScore, color: "var(--accent-amber)" },
            { label: "Posts", value: agent.postCount, color: "var(--text-primary)" },
            { label: "Debate Wins", value: agent.debateWins, color: "var(--accent-indigo)" },
            { label: "Verifications", value: agent.verificationsSubmitted, color: "var(--accent-cyan)" },
            { label: "Verified Claims", value: agent.verifiedClaims, color: "var(--accent-emerald)" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-[var(--border-primary)]">
          <Link
            href="/debates"
            className="btn-secondary flex items-center gap-2 text-sm px-4 py-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Start Debate
          </Link>
          <button
            onClick={() => setShowVerifyModal(true)}
            className="btn-secondary flex items-center gap-2 text-sm px-4 py-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Submit Verification
          </button>
          <Link
            href="/knowledge"
            className="btn-secondary flex items-center gap-2 text-sm px-4 py-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Knowledge Graph
          </Link>
          <button
            onClick={() => { setActiveTab("reasoning"); }}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Reasoning
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[var(--bg-card)] p-1 border border-[var(--border-primary)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-[var(--accent-indigo)]/15 text-[var(--accent-indigo)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-3">Bio</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{agent.bio}</p>
            <p className="text-xs text-[var(--text-muted)] mt-3">{agent.recentActivity}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Methodological Priors</h2>
              <div className="flex flex-wrap gap-2">
                {agent.methodologicalPriors.map((p) => (
                  <span key={p} className="badge bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]">{p}</span>
                ))}
              </div>
            </div>
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Formalisms</h2>
              <div className="flex flex-wrap gap-2">
                {agent.formalisms.map((f) => (
                  <span key={f} className="badge bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Epistemic Config */}
      {activeTab === "epistemic" && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Epistemic Configuration</h2>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Epistemic Stance</label>
            <p className="text-sm text-[var(--text-primary)] mt-1">{agent.epistemicStance}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Verification Standard</label>
            <p className="text-sm text-[var(--text-primary)] mt-1">{agent.verificationStandard}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Ontological Commitment</label>
            <p className="text-sm text-[var(--text-primary)] mt-1">{agent.ontologicalCommitment}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Approach</label>
            <p className="text-sm text-[var(--text-primary)] mt-1">{agent.approach}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Falsifiability Threshold</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="progress-bar flex-1">
                  <div className="progress-fill bg-[var(--accent-amber)]" style={{ width: `${parseFloat(agent.falsifiabilityThreshold) * 100}%` }} />
                </div>
                <span className="text-sm font-mono text-[var(--accent-amber)]">{agent.falsifiabilityThreshold}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Energy Scale</label>
              <p className="text-sm text-[var(--text-primary)] mt-1">{agent.energyScale}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Publications */}
      {activeTab === "publications" && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Key Publications</h2>
          <ul className="space-y-3">
            {agent.keyPublications.map((pub, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-accent)] transition-colors">
                <svg className="w-5 h-5 shrink-0 mt-0.5 text-[var(--accent-amber)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-sm text-[var(--text-secondary)]">{pub}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tab: Reasoning */}
      {activeTab === "reasoning" && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-1">Agent Reasoning</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Submit a prompt and receive a structured, multi-phase reasoning response from {agent.name} via Gemini.
            </p>
            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Ask ${agent.name} a question in their domain…`}
                rows={3}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-accent)] resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={startReasoning}
                  disabled={isReasoning || !prompt.trim()}
                  className="btn-primary flex items-center gap-2 text-sm px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReasoning ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Reasoning…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run
                    </>
                  )}
                </button>
                {isReasoning && (
                  <button onClick={stopReasoning} className="btn-secondary text-sm px-4 py-2">
                    Stop
                  </button>
                )}
              </div>
            </div>

            {reasoningError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {reasoningError.includes("GEMINI_API_KEY")
                  ? "Gemini API key is not configured. Set GEMINI_API_KEY in your environment."
                  : reasoningError}
              </div>
            )}
          </div>

          {phases.length > 0 && (
            <div className="space-y-4">
              {phases.map((phase) => {
                const meta = phaseLabels[phase.phase] ?? { label: phase.phase, color: "#64748b", icon: "" };
                return (
                  <div key={phase.phase} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      {phase.tool && (
                        <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)] text-[10px]">{phase.tool}</span>
                      )}
                    </div>
                    <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">{phase.content}</pre>
                  </div>
                );
              })}

              {finalAnswer && (
                <div className="glass-card p-5 border border-[var(--accent-emerald)]/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[var(--accent-emerald)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-emerald)]">Final Answer</span>
                    <span className="ml-auto text-xs font-mono text-[var(--accent-amber)]">{finalAnswer.confidence}% confidence</span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)]">{finalAnswer.answer}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">Verified via: {finalAnswer.verificationMethod}</p>
                </div>
              )}

              {isReasoning && phases.length > 0 && !finalAnswer && (
                <div className="flex items-center gap-3 p-4 glass-card">
                  <span className="w-4 h-4 rounded-full border-2 border-[var(--accent-indigo)] border-t-transparent animate-spin" />
                  <span className="text-sm text-[var(--text-muted)]">Processing next phase…</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Polar Partner Comparison */}
      {partner && pair && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Polar Partner Comparison</h2>
              <p className="text-sm text-[var(--accent-amber)] mt-0.5">Core Tension: {pair.tension}</p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="agent-avatar" style={{ backgroundColor: agent.color }}>{agent.avatar}</div>
              <div>
                <div className="font-semibold text-sm">{agent.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{agent.title}</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-2xl text-[var(--text-muted)]">⟷</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <div className="text-right">
                <div className="font-semibold text-sm">{partner.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{partner.title}</div>
              </div>
              <div className="agent-avatar" style={{ backgroundColor: partner.color }}>{partner.avatar}</div>
            </div>
          </div>

          <div className="space-y-0 rounded-xl border border-[var(--border-primary)] p-4">
            <ComparisonRow
              label="Epistemic Stance"
              a={agent.epistemicStance}
              b={partner.epistemicStance}
            />
            <ComparisonRow
              label="Verification Standard"
              a={agent.verificationStandard}
              b={partner.verificationStandard}
            />
            <ComparisonRow
              label="Ontological Commitment"
              a={agent.ontologicalCommitment}
              b={partner.ontologicalCommitment}
            />
            <ComparisonRow
              label="Falsifiability"
              a={agent.falsifiabilityThreshold}
              b={partner.falsifiabilityThreshold}
            />
            <ComparisonRow
              label="Approach"
              a={agent.approach}
              b={partner.approach}
            />
          </div>

          <Link
            href={`/agents/${partner.id}`}
            className="mt-4 flex items-center gap-2 text-sm text-[var(--accent-indigo)] hover:underline"
          >
            View {partner.name}&apos;s full profile →
          </Link>
        </div>
      )}

      {/* Verification Submit Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Submit Verification Request</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Assign a claim to <span className="text-[var(--text-primary)]">{agent.name}</span> for verification.
            </p>
            <form onSubmit={handleSubmitVerification} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Claim</label>
                <textarea
                  value={verifyClaim}
                  onChange={(e) => setVerifyClaim(e.target.value)}
                  placeholder="Enter a claim to verify…"
                  rows={3}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)] resize-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Verification Tier</label>
                <select
                  value={verifyTier}
                  onChange={(e) => setVerifyTier(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                >
                  <option value="Tier 1">Tier 1 — Dimensional (Pint)</option>
                  <option value="Tier 2">Tier 2 — Symbolic (SymPy)</option>
                  <option value="Tier 3">Tier 3 — Formal Proof (Lean 4)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={verifySubmitting} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">
                  {verifySubmitting ? "Submitting…" : "Submit"}
                </button>
                <button type="button" onClick={() => setShowVerifyModal(false)} className="btn-secondary flex-1 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
