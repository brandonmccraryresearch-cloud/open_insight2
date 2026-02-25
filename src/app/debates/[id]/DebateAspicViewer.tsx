"use client";
import { useState } from "react";
import { useAspicViewer, ASPIC_FRAMEWORKS } from "@/components/AspicViewer";

const attackTypeColors: Record<string, { color: string; label: string }> = {
  rebut: { color: "#ef4444", label: "Rebut" },
  undercut: { color: "#f59e0b", label: "Undercut" },
  undermine: { color: "#8b5cf6", label: "Undermine" },
};

const statusColors: Record<string, { color: string; bg: string }> = {
  undefeated: { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  defeated: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  blocking: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
};

export default function DebateAspicViewer({ debateId }: { debateId: string }) {
  // Map debate IDs to ASPIC framework keys
  const frameworkKey = debateId.includes("collapse") || debateId.includes("everett") || debateId.includes("penrose")
    ? "collapse-debate"
    : debateId.includes("bishop") || debateId.includes("construct") || debateId.includes("goedel") || debateId.includes("math")
    ? "constructivism-debate"
    : Object.keys(ASPIC_FRAMEWORKS)[0];

  const {
    framework,
    selectedArg,
    setSelectedArg,
    showExtension,
    setShowExtension,
    getAttacksOn,
    getAttacksFrom,
    isInExtension,
  } = useAspicViewer(frameworkKey ?? "");

  const [open, setOpen] = useState(false);

  if (!framework) return null;

  const selectedArgData = selectedArg ? framework.arguments.find((a) => a.id === selectedArg) : null;
  const attacksOnSelected = selectedArg ? getAttacksOn(selectedArg) : [];
  const attacksFromSelected = selectedArg ? getAttacksFrom(selectedArg) : [];

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--bg-card-hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[var(--accent-indigo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-semibold text-sm">ASPIC+ Argument Structure</span>
          <span className="badge bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]" style={{ fontSize: 10 }}>
            {framework.arguments.length} arguments · {framework.attacks.length} attacks
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--border-primary)]">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-[var(--accent-indigo)]">{framework.title}</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowExtension(showExtension === "grounded" ? null : "grounded")}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${showExtension === "grounded" ? "bg-[var(--accent-emerald)]/15 border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]" : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                >
                  Grounded Ext.
                </button>
                <button
                  onClick={() => setShowExtension(showExtension === "preferred-1" ? null : "preferred-1")}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${showExtension === "preferred-1" ? "bg-[var(--accent-indigo)]/15 border-[var(--accent-indigo)]/30 text-[var(--accent-indigo)]" : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                >
                  Preferred 1
                </button>
                <button
                  onClick={() => setShowExtension(showExtension === "preferred-2" ? null : "preferred-2")}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${showExtension === "preferred-2" ? "bg-[var(--accent-violet)]/15 border-[var(--accent-violet)]/30 text-[var(--accent-violet)]" : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                >
                  Preferred 2
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {framework.arguments.map((arg) => {
                const st = statusColors[arg.status];
                const inExt = isInExtension(arg.id);
                const isSelected = selectedArg === arg.id;
                return (
                  <button
                    key={arg.id}
                    onClick={() => setSelectedArg(isSelected ? null : arg.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${isSelected ? "ring-1 ring-[var(--accent-indigo)]" : ""} ${!inExt ? "opacity-30" : ""}`}
                    style={{ borderColor: isSelected ? "var(--accent-indigo)" : st.bg, backgroundColor: `${st.bg}` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono" style={{ color: st.color }}>{arg.id}</span>
                      <span className="badge" style={{ backgroundColor: st.bg, color: st.color, fontSize: 9 }}>{arg.status}</span>
                      <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]" style={{ fontSize: 9 }}>{arg.strength}</span>
                    </div>
                    <p className="text-xs font-medium text-[var(--text-primary)] mb-2">{arg.claim}</p>
                    <div className="space-y-1">
                      {arg.premises.map((p, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-[var(--text-muted)]">
                          <span className="shrink-0 mt-0.5">•</span>
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedArgData && (
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--accent-indigo)]/20 space-y-3">
                <h4 className="text-sm font-semibold text-[var(--accent-indigo)]">
                  {selectedArgData.id}: {selectedArgData.claim}
                </h4>
                <p className="text-xs text-[var(--accent-emerald)]">
                  <strong>Conclusion:</strong> {selectedArgData.conclusion}
                </p>

                {attacksOnSelected.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Attacked by:</p>
                    <div className="space-y-1">
                      {attacksOnSelected.map((atk) => {
                        const tc = attackTypeColors[atk.type];
                        return (
                          <div key={atk.id} className="flex items-start gap-2 text-xs">
                            <span className="badge shrink-0 mt-0.5" style={{ backgroundColor: `${tc.color}20`, color: tc.color, fontSize: 9 }}>{tc.label}</span>
                            <span className="text-[var(--text-muted)]">{atk.attackerId}: {atk.reason}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {attacksFromSelected.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Attacks:</p>
                    <div className="space-y-1">
                      {attacksFromSelected.map((atk) => {
                        const tc = attackTypeColors[atk.type];
                        return (
                          <div key={atk.id} className="flex items-start gap-2 text-xs">
                            <span className="badge shrink-0 mt-0.5" style={{ backgroundColor: `${tc.color}20`, color: tc.color, fontSize: 9 }}>{tc.label} → {atk.targetId}</span>
                            <span className="text-[var(--text-muted)]">{atk.reason}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-4 flex-wrap">
              {Object.entries(attackTypeColors).map(([type, tc]) => (
                <span key={type} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tc.color }} />
                  {tc.label}
                </span>
              ))}
              <span className="ml-auto">Click an argument to inspect attacks · Use extension buttons to filter</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
