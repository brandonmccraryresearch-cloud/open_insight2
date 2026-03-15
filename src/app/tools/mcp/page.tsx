"use client";
import { useState, useEffect, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import MathRenderer from "@/components/MathRenderer";

// ── Types ────────────────────────────────────────────────────────────────────

interface McpServerStatus {
  available: boolean;
  binaryFound: boolean;
  executionMode: "mcp" | "gemini";
  description: string;
}

interface RouteStatus {
  available: boolean;
  executionMode: string;
  requires: string[];
}

interface ToolStatusResponse {
  timestamp: string;
  gemini: boolean;
  lean4: { available: boolean; executionMode: string };
  playwright: { available: boolean; executionMode: string };
  mcp: Record<string, McpServerStatus>;
  routes: Record<string, RouteStatus>;
}

interface ToolCallResult {
  output?: string;
  result?: unknown;
  executionMode?: string;
  error?: string;
  responseTimeMs?: number;
}

// ── Tool definitions with "Try It" examples ──────────────────────────────────

const mcpToolDefs = [
  {
    id: "math",
    name: "Symbolic Math",
    serverId: "scicomp-math-mcp",
    color: "#f59e0b",
    icon: "M4.871 4A17.926 17.926 0 003 12c0 2.874.673 5.59 1.871 8m14.13 0A17.926 17.926 0 0021 12a17.926 17.926 0 00-2.999-8M9 9h1.246a1 1 0 01.961.725l1.586 5.55a1 1 0 00.961.725H15m-6 0l3-9",
    description: "Symbolic algebra, calculus, equation solving via SymPy",
    examples: [
      { label: "Integrate sin(x)dx", endpoint: "/api/tools/math", body: { operation: "integrate", expression: "sin(x)", variable: "x" } },
      { label: "Solve x² - 5x + 6 = 0", endpoint: "/api/tools/math", body: { operation: "solve", expression: "x**2 - 5*x + 6", variable: "x" } },
      { label: "Differentiate x³·ln(x)", endpoint: "/api/tools/math", body: { operation: "differentiate", expression: "x**3 * log(x)", variable: "x" } },
    ],
  },
  {
    id: "quantum",
    name: "Quantum Simulation",
    serverId: "scicomp-quantum-mcp",
    color: "#8b5cf6",
    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    description: "Schrödinger equation, wave packets, quantum simulation",
    examples: [
      { label: "Gaussian wavepacket", endpoint: "/api/tools/quantum", body: { operation: "wavepacket", grid_size: 256, position: 0, momentum: 5, width: 0.5 } },
      { label: "Harmonic oscillator", endpoint: "/api/tools/quantum", body: { operation: "harmonic_oscillator", n_states: 5 } },
    ],
  },
  {
    id: "molecular",
    name: "Molecular Dynamics",
    serverId: "scicomp-molecular-mcp",
    color: "#10b981",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    description: "Lennard-Jones MD, RDF, MSD, thermodynamic ensembles",
    examples: [
      { label: "LJ fluid (20 particles)", endpoint: "/api/tools/molecular", body: { operation: "simulate", n_particles: 20, box_size: 10.0, n_steps: 100 } },
    ],
  },
  {
    id: "neural",
    name: "Neural Networks",
    serverId: "scicomp-neural-mcp",
    color: "#06b6d4",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
    description: "Neural network training, evaluation, model analysis",
    examples: [
      { label: "ResNet-18 summary", endpoint: "/api/tools/neural", body: { operation: "define_model", architecture: "resnet18" } },
      { label: "MobileNet summary", endpoint: "/api/tools/neural", body: { operation: "define_model", architecture: "mobilenet" } },
    ],
  },
  {
    id: "pdg",
    name: "Particle Data (PDG)",
    serverId: "particlephysics-mcp",
    color: "#ec4899",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    description: "PDG particle database — 400+ particles, masses, lifetimes, decay modes",
    examples: [
      { label: "Electron properties", endpoint: "/api/tools/pdg", body: { query: "electron mass and properties" } },
      { label: "Higgs boson", endpoint: "/api/tools/pdg", body: { query: "Higgs boson mass decay channels" } },
      { label: "Top quark", endpoint: "/api/tools/pdg", body: { query: "top quark mass and lifetime" } },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function McpDashboardPage() {
  const [status, setStatus] = useState<ToolStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string>("math");
  const [callResult, setCallResult] = useState<ToolCallResult | null>(null);
  const [calling, setCalling] = useState(false);
  const [callHistory, setCallHistory] = useState<Array<{ tool: string; example: string; result: ToolCallResult; timestamp: string }>>([]);

  // Read ?tool= from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tool");
      if (t && mcpToolDefs.some((d) => d.id === t)) setSelectedTool(t);
    }
  }, []);

  const refreshStatus = useCallback(() => {
    setLoading(true);
    fetch("/api/tools/status")
      .then((r) => r.json())
      .then((data: ToolStatusResponse) => setStatus(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [refreshStatus]);

  async function tryExample(toolId: string, exampleLabel: string, endpoint: string, body: Record<string, unknown>) {
    setCalling(true);
    setCallResult(null);
    const startTime = performance.now();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const responseTimeMs = Math.round(performance.now() - startTime);
      const result: ToolCallResult = {
        output: data.output ?? data.result ?? JSON.stringify(data, null, 2),
        executionMode: data.executionMode,
        error: data.error,
        responseTimeMs,
      };
      setCallResult(result);
      setCallHistory((prev) => [
        { tool: toolId, example: exampleLabel, result, timestamp: new Date().toISOString() },
        ...prev.slice(0, 19),
      ]);
    } catch (err) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      const result: ToolCallResult = { error: err instanceof Error ? err.message : "Network error", responseTimeMs };
      setCallResult(result);
    } finally {
      setCalling(false);
    }
  }

  const activeTool = mcpToolDefs.find((t) => t.id === selectedTool) ?? mcpToolDefs[0];

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">MCP Tool Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Real-time status and interactive testing for all MCP scientific computing servers
          </p>
        </div>
        <button
          onClick={refreshStatus}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "⟳ Refresh Status"}
        </button>
      </div>

      {/* Overall status banner */}
      {status && (
        <div className="glass-card p-4">
          <div className="flex flex-wrap gap-6 text-xs">
            <div className="flex items-center gap-2" title="Gemini API availability for fallback computation">
              <span className={`w-2.5 h-2.5 rounded-full ${status.gemini ? "bg-[#10b981]" : "bg-[#ef4444]"}`} />
              <span className="text-[var(--text-secondary)]">Gemini API</span>
              <span className="font-mono text-[var(--text-muted)]">{status.gemini ? "connected" : "unavailable"}</span>
            </div>
            <div className="flex items-center gap-2" title="Lean 4 interactive theorem prover">
              <span className={`w-2.5 h-2.5 rounded-full ${status.lean4.available ? "bg-[#10b981]" : "bg-[#64748b]"}`} />
              <span className="text-[var(--text-secondary)]">Lean 4</span>
              <span className="font-mono text-[var(--text-muted)]">{status.lean4.executionMode}</span>
            </div>
            <div className="flex items-center gap-2" title="Playwright browser automation">
              <span className={`w-2.5 h-2.5 rounded-full ${status.playwright.available ? "bg-[#10b981]" : "bg-[#64748b]"}`} />
              <span className="text-[var(--text-secondary)]">Playwright</span>
              <span className="font-mono text-[var(--text-muted)]">{status.playwright.executionMode}</span>
            </div>
            <div className="ml-auto text-[var(--text-muted)]" title="Last status check timestamp">
              Updated: {new Date(status.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* MCP Server Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {mcpToolDefs.map((tool) => {
          const serverStatus = status?.mcp[tool.serverId];
          const routeStatus = status?.routes[tool.id];
          const isMcp = serverStatus?.executionMode === "mcp";
          const isAvailable = routeStatus?.available ?? false;
          const isSelected = selectedTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => { setSelectedTool(tool.id); setCallResult(null); }}
              aria-label={`Select ${tool.name} tool — ${isMcp ? "Real MCP server" : isAvailable ? "Gemini fallback" : "offline"}`}
              className={`glass-card p-4 text-left transition-all ${isSelected ? "ring-1" : ""}`}
              style={isSelected ? { borderColor: tool.color, boxShadow: `0 0 20px ${tool.color}20` } : {}}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5" style={{ color: tool.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                </svg>
                <span className="font-semibold text-sm">{tool.name}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isMcp ? "#10b981" : isAvailable ? "#f59e0b" : "#ef4444" }}
                />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {isMcp ? "MCP" : isAvailable ? "Gemini" : "offline"}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">{tool.description}</p>
              {serverStatus && (
                <div className="mt-2 text-[9px] text-[var(--text-muted)]">
                  Binary: {serverStatus.binaryFound ? "✓" : "✗"}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tool panel with "Try It" */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Try It Panel */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5" style={{ color: activeTool.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={activeTool.icon} />
            </svg>
            <h2 className="text-base font-semibold">Try: {activeTool.name}</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{activeTool.description}</p>

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-[var(--text-muted)]">Quick examples</h3>
            {activeTool.examples.map((ex) => (
              <button
                key={ex.label}
                onClick={() => tryExample(activeTool.id, ex.label, ex.endpoint, ex.body)}
                disabled={calling}
                className="w-full text-left px-3 py-2 rounded-lg border border-[var(--border-primary)] hover:border-[var(--border-accent)] transition-colors text-sm disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span>{ex.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">▶ Run</span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                  POST {ex.endpoint}
                </div>
              </button>
            ))}
          </div>

          {calling && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span className="w-3 h-3 border-2 border-[var(--accent-teal)] border-t-transparent rounded-full animate-spin" />
              Running…
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-base font-semibold">Result</h2>
          {callResult ? (
            <>
              {callResult.executionMode && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: callResult.executionMode === "mcp" ? "#10b981" : "#f59e0b" }}
                    />
                    <span className="font-mono text-[var(--text-muted)]">
                      executionMode: {callResult.executionMode}
                    </span>
                  </div>
                  {callResult.responseTimeMs != null && (
                    <span className="font-mono text-[var(--text-muted)]" title="Round-trip response time including network latency">
                      ⏱ {formatDuration(callResult.responseTimeMs)}
                    </span>
                  )}
                </div>
              )}
              {callResult.error ? (
                <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] text-[#ef4444] text-sm font-mono whitespace-pre-wrap">
                  {callResult.error}
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  {typeof callResult.output === "string" ? (
                    (() => {
                      // Try to detect LaTeX in the output
                      const latexMatch = callResult.output.match(/\$\$(.*?)\$\$/s);
                      if (latexMatch) {
                        return (
                          <div className="space-y-2">
                            <MathRenderer tex={latexMatch[1]} />
                            <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ fontSize: 11, borderRadius: 8, background: "rgba(0,0,0,0.3)" }}>
                              {callResult.output}
                            </SyntaxHighlighter>
                          </div>
                        );
                      }
                      // Try to parse as JSON for structured display
                      try {
                        const parsed = JSON.parse(callResult.output);
                        return (
                          <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ fontSize: 11, borderRadius: 8, background: "rgba(0,0,0,0.3)" }}>
                            {JSON.stringify(parsed, null, 2)}
                          </SyntaxHighlighter>
                        );
                      } catch {
                        return (
                          <pre className="text-xs text-[var(--text-primary)] font-mono whitespace-pre-wrap p-3 rounded-lg bg-[rgba(0,0,0,0.3)]">
                            {callResult.output}
                          </pre>
                        );
                      }
                    })()
                  ) : (
                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ fontSize: 11, borderRadius: 8, background: "rgba(0,0,0,0.3)" }}>
                      {JSON.stringify(callResult.output, null, 2)}
                    </SyntaxHighlighter>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-[var(--text-muted)] py-8 text-center">
              Select an example and click ▶ Run to see results
            </div>
          )}
        </div>
      </div>

      {/* Execution History */}
      {callHistory.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent Tool Calls</h2>
            {/* Metrics summary */}
            {(() => {
              const withTime = callHistory.filter((e) => e.result.responseTimeMs != null);
              const successCount = callHistory.filter((e) => !e.result.error).length;
              const avgMs = withTime.length > 0
                ? Math.round(withTime.reduce((s, e) => s + (e.result.responseTimeMs ?? 0), 0) / withTime.length)
                : 0;
              return (
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span title="Total tool calls made this session">
                    {callHistory.length} calls
                  </span>
                  <span title="Percentage of calls that succeeded without errors">
                    {callHistory.length > 0 ? Math.round((successCount / callHistory.length) * 100) : 0}% success
                  </span>
                  {avgMs > 0 && (
                    <span title="Average round-trip response time">
                      avg {formatDuration(avgMs)}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {callHistory.map((entry, i) => {
              const tool = mcpToolDefs.find((t) => t.id === entry.tool);
              return (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg border border-[var(--border-primary)] text-xs">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: entry.result.error ? "#ef4444" : entry.result.executionMode === "mcp" ? "#10b981" : "#f59e0b" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: tool?.color }}>{tool?.name ?? entry.tool}</span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span className="truncate">{entry.example}</span>
                    </div>
                    <div className="text-[var(--text-muted)] font-mono mt-0.5">
                      {entry.result.executionMode && `[${entry.result.executionMode}] `}
                      {entry.result.responseTimeMs != null && `${entry.result.responseTimeMs}ms · `}
                      {entry.result.error
                        ? `Error: ${entry.result.error.slice(0, 80)}`
                        : typeof entry.result.output === "string"
                          ? entry.result.output.slice(0, 120)
                          : "✓ success"}
                    </div>
                  </div>
                  <span className="text-[var(--text-muted)] shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Routes Status Table */}
      {status?.routes && (
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-base font-semibold">All Tool Routes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-muted)] text-left">
                  <th className="pb-2 pr-4">Route</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Execution Mode</th>
                  <th className="pb-2">Requires</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {Object.entries(status.routes).map(([route, rs]) => (
                  <tr key={route} className="border-t border-[var(--border-primary)]">
                    <td className="py-1.5 pr-4 font-mono">/api/tools/{route}</td>
                    <td className="py-1.5 pr-4">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${rs.available ? "bg-[#10b981]" : "bg-[#ef4444]"}`} />
                        {rs.available ? "available" : "unavailable"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 font-mono">{rs.executionMode}</td>
                    <td className="py-1.5 font-mono text-[var(--text-muted)]">
                      {rs.requires.length > 0 ? rs.requires.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
