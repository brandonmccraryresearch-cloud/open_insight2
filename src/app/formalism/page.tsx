"use client";
import { useState, useEffect, useMemo } from "react";
import { useFormalismAnalysis, BANNED_PHRASES, type FormalismViolation } from "@/components/FormalismEngine";
import { classifyDiscovery, CLASS_DEFINITIONS, type ClassificationResult } from "@/components/DiscoveryClassification";

const SAMPLE_TEXT = `In this paper we investigate how quantum fluctuations lead to spontaneous symmetry breaking
in the early universe. We observe that the vacuum state undergoes a phase transition where
emergence of classical spacetime occurs through decoherence.

The collapse of the wavefunction at the measurement boundary creates definite outcomes.
Virtual particles mediate the interaction between fields, and nature chooses the lowest
energy configuration through quantum tunneling.

We predict that the information is lost in black holes, contradicting unitarity. This novel
framework resolves the anomaly between quantum mechanics and general relativity.

Given E = mc^2, let hbar = 1.055e-34, define G = 6.674e-11.
We derive T_H from first principles. The result is falsifiable and makes testable predictions.`;

const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
  metaphor: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Metaphor" },
  vagueness: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Vagueness" },
  handwaving: { bg: "rgba(249,115,22,0.1)", text: "#f97316", label: "Handwaving" },
  emergence: { bg: "rgba(139,92,246,0.1)", text: "#8b5cf6", label: "Emergence" },
};

export default function FormalismPage() {
  const { violations, paramAudit, dimChecks, analyze } = useFormalismAnalysis();
  const [text, setText] = useState(SAMPLE_TEXT);
  const classification = useMemo<ClassificationResult | null>(() => classifyDiscovery(text), [text]);
  const [activeTab, setActiveTab] = useState<"violations" | "params" | "classify">("violations");

  useEffect(() => {
    analyze(text);
  }, [text, analyze]);

  // Highlight violations in text
  const highlightedText = () => {
    if (violations.length === 0) return text;
    let result = text;
    // Sort by position descending to replace from end
    const sorted = [...violations].sort((a, b) => b.position.start - a.position.start);
    sorted.forEach((v) => {
      const before = result.slice(0, v.position.start);
      const match = result.slice(v.position.start, v.position.end);
      const after = result.slice(v.position.end);
      result = before + `【${match}】` + after;
    });
    return result;
  };

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hyper-Literal Formalism Engine</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Enforcing rigorous language in academic discourse. Auto-detects banned metaphors, vague terminology,
          and hand-waving. Based on the HLRE methodology.
        </p>
      </div>

      {/* Banned phrases reference */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Banned Phrase Dictionary ({BANNED_PHRASES.length} rules)</h3>
          <div className="flex gap-2">
            {Object.entries(categoryColors).map(([cat, info]) => (
              <span key={cat} className="badge" style={{ backgroundColor: info.bg, color: info.text, fontSize: 10 }}>
                {info.label}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {BANNED_PHRASES.map((bp, i) => {
            const cat = categoryColors[bp.category];
            return (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-primary)] text-xs">
                <span className="badge shrink-0 mt-0.5" style={{ backgroundColor: cat.bg, color: cat.text, fontSize: 9 }}>{cat.label}</span>
                <div>
                  <span className="text-[var(--accent-rose)] line-through">{bp.banned}</span>
                  <span className="text-[var(--text-muted)] mx-1">&rarr;</span>
                  <span className="text-[var(--accent-emerald)]">{bp.replacement.slice(0, 80)}...</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Input Text (paste or edit)</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-80 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-4 text-sm text-[var(--text-primary)] font-mono leading-relaxed resize-none outline-none focus:border-[var(--accent-indigo)]"
            spellCheck={false}
          />
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span>{text.length} chars</span>
            <span>{text.split("\n").length} lines</span>
            <span>{text.split(/\s+/).filter(Boolean).length} words</span>
          </div>
        </div>

        {/* Analysis */}
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-[var(--border-primary)] pb-1">
            {[
              { key: "violations", label: `Violations (${violations.length})`, color: violations.length > 0 ? "#ef4444" : "#10b981" },
              { key: "params", label: "Parameter Audit", color: "#f59e0b" },
              { key: "classify", label: "Discovery Class", color: "#8b5cf6" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.key ? "tab-active" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
                style={activeTab === tab.key ? { color: tab.color } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "violations" && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {violations.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <div className="text-2xl mb-2" style={{ color: "#10b981" }}>&#x2713;</div>
                  <p className="text-sm text-[var(--accent-emerald)]">No formalism violations detected</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Text passes hyper-literal formalism check</p>
                </div>
              ) : (
                violations.map((v, i) => {
                  const cat = categoryColors[v.category];
                  return (
                    <div key={i} className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge" style={{ backgroundColor: cat.bg, color: cat.text, fontSize: 10 }}>{cat.label}</span>
                        <span className="text-xs text-[var(--text-muted)]">Line {v.line}</span>
                      </div>
                      <div className="mb-2">
                        <span className="text-sm font-medium text-[var(--accent-rose)] line-through">{v.phrase}</span>
                      </div>
                      <div className="p-2 rounded bg-[var(--accent-emerald)]/5 border border-[var(--accent-emerald)]/20">
                        <span className="text-xs text-[var(--text-muted)]">Replace with: </span>
                        <span className="text-xs text-[var(--accent-emerald)]">{v.replacement}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "params" && paramAudit && (
            <div className="space-y-4">
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold mb-3">Parameter Accounting</h4>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <div className="text-xl font-bold font-mono text-[var(--accent-cyan)]">{paramAudit.inputs.length}</div>
                    <div className="text-xs text-[var(--text-muted)]">Inputs</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-[var(--accent-amber)]">{paramAudit.outputs.length}</div>
                    <div className="text-xs text-[var(--text-muted)]">Outputs</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-[var(--accent-rose)]">{paramAudit.freeParameters.length}</div>
                    <div className="text-xs text-[var(--text-muted)]">Free Params</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{
                  backgroundColor: paramAudit.status === "balanced" ? "rgba(16,185,129,0.1)" : paramAudit.status === "underconstrained" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: paramAudit.status === "balanced" ? "rgba(16,185,129,0.2)" : paramAudit.status === "underconstrained" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                }}>
                  <span className="text-sm font-medium" style={{
                    color: paramAudit.status === "balanced" ? "#10b981" : paramAudit.status === "underconstrained" ? "#ef4444" : "#f59e0b",
                  }}>
                    Efficiency Ratio: {paramAudit.efficiencyRatio}
                  </span>
                  <span className="badge" style={{
                    backgroundColor: paramAudit.status === "balanced" ? "rgba(16,185,129,0.2)" : paramAudit.status === "underconstrained" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                    color: paramAudit.status === "balanced" ? "#10b981" : paramAudit.status === "underconstrained" ? "#ef4444" : "#f59e0b",
                  }}>
                    {paramAudit.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Ratio &lt; 1: underconstrained (too few inputs). Ratio 1-3: balanced. Ratio &gt; 3: overconstrained.
                </p>
              </div>
              {paramAudit.inputs.length > 0 && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Detected Inputs</h4>
                  <div className="flex flex-wrap gap-1">
                    {paramAudit.inputs.map((p) => (
                      <span key={p} className="badge bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {paramAudit.outputs.length > 0 && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Detected Outputs</h4>
                  <div className="flex flex-wrap gap-1">
                    {paramAudit.outputs.map((p) => (
                      <span key={p} className="badge bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]">{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "classify" && classification && (
            <div className="space-y-4">
              <div className="glass-card p-6 text-center">
                <div className="text-4xl font-bold font-mono mb-2" style={{ color: classification.color }}>
                  Class {classification.discoveryClass}
                </div>
                <h3 className="text-lg font-semibold" style={{ color: classification.color }}>
                  {classification.label}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{classification.description}</p>
                <div className="mt-4">
                  <div className="text-sm text-[var(--text-muted)]">Confidence</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: classification.color }}>
                    {classification.confidence}%
                  </div>
                  <div className="progress-bar mt-2 mx-auto max-w-xs">
                    <div className="progress-fill" style={{ width: `${classification.confidence}%`, backgroundColor: classification.color }} />
                  </div>
                </div>
              </div>

              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold mb-3">Criteria Assessment</h4>
                <div className="space-y-2">
                  {classification.criteria.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${c.met ? "bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
                        {c.met ? "\u2713" : "\u2717"}
                      </span>
                      <span className={c.met ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All classes reference */}
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold mb-3">Discovery Classification Scale</h4>
                <div className="space-y-3">
                  {([1, 2, 3] as const).map((cls) => {
                    const def = CLASS_DEFINITIONS[cls];
                    const isActive = classification.discoveryClass === cls;
                    return (
                      <div key={cls} className={`p-3 rounded-lg border ${isActive ? "border-opacity-50" : "border-transparent"}`}
                        style={isActive ? { borderColor: def.color, backgroundColor: `color-mix(in srgb, ${def.color} 5%, transparent)` } : {}}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono" style={{ color: def.color }}>{cls}</span>
                          <span className="text-sm font-medium" style={{ color: isActive ? def.color : "var(--text-secondary)" }}>{def.label}</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{def.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
