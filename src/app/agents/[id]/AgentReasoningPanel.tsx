"use client";
import { useState, useRef, useEffect } from "react";
import MathRenderer from "@/components/MathRenderer";
import ReactMarkdown from "react-markdown";
import type { AgentThought } from "@/components/AgentReasoning";

const phaseColors: Record<string, { color: string; label: string; icon: string }> = {
  decomposition: { color: "#06b6d4", label: "Decomposition", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  "tool-thinking": { color: "#f59e0b", label: "Tool Call", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  critique: { color: "#ef4444", label: "Self-Critique", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
  synthesis: { color: "#10b981", label: "Synthesis", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
};

const PHASE_ORDER = ["decomposition", "tool-thinking", "critique", "synthesis"] as const;

interface LivePhase {
  phase: string;
  content: string;
  tool?: string;
  done: boolean;
}

interface FinalResult {
  answer: string;
  confidence: number;
  verificationMethod: string;
}

function renderContent(text: string) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("$$") && part.endsWith("$$")) return <MathRenderer key={i} tex={part.slice(2, -2)} display />;
    if (part.startsWith("$") && part.endsWith("$")) return <MathRenderer key={i} tex={part.slice(1, -1)} />;
    return <ReactMarkdown key={i}>{part}</ReactMarkdown>;
  });
}

export default function AgentReasoningPanel({ agentId }: { agentId: string }) {
  const [chains, setChains] = useState<Record<string, AgentThought>>({});

  // Lazy-load reasoning chains only when this panel mounts
  useEffect(() => {
    import("@/data/reasoningChains").then((mod) => setChains(mod.REASONING_CHAINS));
  }, []);

  const availableChains = Object.entries(chains)
    .filter(([, chain]) => chain.agentId === agentId)
    .map(([key, chain]) => ({ key, prompt: chain.prompt }));

  const [selectedChain, setSelectedChain] = useState(availableChains[0]?.key ?? "");
  const [customPrompt, setCustomPrompt] = useState("");

  // Live Gemini streaming state
  const [livePhases, setLivePhases] = useState<LivePhase[]>([]);
  const [liveRunning, setLiveRunning] = useState(false);
  const [liveFinal, setLiveFinal] = useState<FinalResult | null>(null);
  const [rawStream, setRawStream] = useState("");
  const [streamMode, setStreamMode] = useState<"chain" | "custom" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function resetLive() {
    abortRef.current?.abort();
    setLivePhases([]);
    setLiveFinal(null);
    setRawStream("");
    setLiveRunning(false);
    setStreamMode(null);
  }

  async function streamFromApi(prompt: string, mode: "chain" | "custom") {
    resetLive();
    setLiveRunning(true);
    setStreamMode(mode);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/agents/${agentId}/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const data = JSON.parse(payload) as { text?: string; error?: string };
            if (data.error) { setRawStream((p) => p + `\n[Error: ${data.error}]`); continue; }
            if (!data.text) continue;

            buffer += data.text;

            if (mode === "chain") {
              // Try to parse structured phase JSON lines from the buffer
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const l of lines) {
                const trimmed = l.trim();
                if (!trimmed.startsWith("{")) continue;
                try {
                  const obj = JSON.parse(trimmed) as Record<string, unknown>;
                  if (obj.phase && typeof obj.content === "string") {
                    setLivePhases((prev) => {
                      const existing = prev.findIndex((p) => p.phase === obj.phase);
                      if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = { ...updated[existing], content: updated[existing].content + (obj.content as string), done: false };
                        return updated;
                      }
                      return [...prev, { phase: obj.phase as string, content: obj.content as string, tool: obj.tool as string | undefined, done: true }];
                    });
                  } else if (obj.final) {
                    setLiveFinal({
                      answer: String(obj.answer ?? ""),
                      confidence: Number(obj.confidence ?? 0),
                      verificationMethod: String(obj.verificationMethod ?? ""),
                    });
                  }
                } catch { /* not a phase line yet */ }
              }
            } else {
              setRawStream((p) => p + data.text);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setRawStream((p) => p + "\n[Stream ended]");
      }
    }

    setLiveRunning(false);
  }

  const activePrompt = availableChains.find((c) => c.key === selectedChain)?.prompt ?? "";

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--accent-indigo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Live Reasoning
        <span className="badge text-[9px] bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]">gemini-3.1-pro-preview</span>
      </h2>

      {/* Predefined chain selector */}
      {availableChains.length > 0 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Reasoning Chain</label>
            <select
              value={selectedChain}
              onChange={(e) => { setSelectedChain(e.target.value); resetLive(); }}
              className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              {availableChains.map((c) => (
                <option key={c.key} value={c.key}>{c.prompt.slice(0, 80)}…</option>
              ))}
            </select>
          </div>

          {activePrompt && (
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)]">
              <p className="text-xs font-mono text-[var(--accent-indigo)]">{activePrompt}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => liveRunning ? resetLive() : streamFromApi(activePrompt, "chain")}
              className={`px-4 py-2 rounded-lg text-xs font-medium text-white ${liveRunning && streamMode === "chain" ? "bg-[var(--accent-rose)]" : "bg-[var(--accent-indigo)]"} hover:opacity-90`}
            >
              {liveRunning && streamMode === "chain" ? "⏹ Stop" : "▶ Run Reasoning Chain"}
            </button>
            {!liveRunning && (livePhases.length > 0 || liveFinal) && (
              <button onClick={resetLive} className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]">
                Reset
              </button>
            )}
          </div>

          {/* Structured phase output */}
          {(livePhases.length > 0 || (liveRunning && streamMode === "chain")) && (
            <div className="space-y-3">
              {PHASE_ORDER.map((phaseName) => {
                const phaseData = livePhases.find((p) => p.phase === phaseName);
                const isCurrent = liveRunning && streamMode === "chain" && !phaseData && livePhases.length === PHASE_ORDER.indexOf(phaseName);
                const phase = phaseColors[phaseName];
                if (!phaseData && !isCurrent && !(liveRunning && streamMode === "chain")) return null;
                return (
                  <div
                    key={phaseName}
                    className={`rounded-xl border p-4 transition-all ${!phaseData && !isCurrent ? "opacity-30" : "opacity-100"}`}
                    style={{
                      borderColor: phaseData || isCurrent ? `${phase.color}40` : "var(--border-primary)",
                      backgroundColor: phaseData || isCurrent ? `color-mix(in srgb, ${phase.color} 5%, transparent)` : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${phase.color}20` }}>
                        {phaseData ? (
                          <svg className="w-3.5 h-3.5" style={{ color: phase.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <span className="w-2 h-2 rounded-full status-pulse" style={{ backgroundColor: phase.color }} />
                        )}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: phase.color }}>{phase.label}</span>
                      {phaseData?.tool && <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 9 }}>{phaseData.tool}</span>}
                    </div>
                    {phaseData && (
                      <div className="text-xs text-[var(--text-secondary)] leading-relaxed pl-8 max-h-56 overflow-y-auto">
                        <div className="prose prose-sm prose-invert max-w-none">{renderContent(phaseData.content)}</div>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="pl-8 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="w-2 h-2 rounded-full status-pulse" style={{ backgroundColor: phase.color }} />
                        Generating…
                      </div>
                    )}
                  </div>
                );
              })}

              {liveFinal && (
                <div className="p-4 rounded-xl border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/5">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-[var(--accent-emerald)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-xs font-semibold text-[var(--accent-emerald)]">Final Answer</span>
                    <span className="text-xs font-mono text-[var(--accent-emerald)] ml-auto">{liveFinal.confidence}% confidence</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] pl-6">{liveFinal.answer}</p>
                  <p className="text-[10px] text-[var(--text-muted)] pl-6 mt-1">Verified via: {liveFinal.verificationMethod}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom prompt / raw stream */}
      <div className="border-t border-[var(--border-primary)] pt-4 space-y-3">
        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Custom Prompt (Gemini-powered)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && customPrompt.trim() && streamFromApi(customPrompt, "custom")}
            placeholder="Ask this agent a question…"
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
          />
          <button
            onClick={() => customPrompt.trim() && streamFromApi(customPrompt, "custom")}
            disabled={liveRunning && streamMode === "custom" || !customPrompt.trim()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-indigo)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {liveRunning && streamMode === "custom" ? "…" : "Ask"}
          </button>
        </div>
        {(rawStream || (liveRunning && streamMode === "custom")) && (
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] max-h-64 overflow-y-auto">
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-mono">
              {rawStream}
              {liveRunning && streamMode === "custom" && <span className="w-2 h-4 inline-block bg-[var(--accent-indigo)] ml-0.5 status-pulse" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


