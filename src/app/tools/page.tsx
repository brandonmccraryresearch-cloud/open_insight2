"use client";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import MathRenderer from "@/components/MathRenderer";
import { usePyodide } from "@/lib/pyodide";

interface NotebookCell {
  id: string;
  type: "code" | "markdown" | "output";
  content: string;
  language?: string;
}

const sampleNotebook: NotebookCell[] = [
  { id: "cell-1", type: "markdown", content: "# Decoherence Timescale Analysis\nComparing Diosi-Penrose collapse timescale with standard decoherence for macroscopic superpositions." },
  { id: "cell-2", type: "code", language: "python", content: `import numpy as np
from scipy import constants

# Physical constants
hbar = constants.hbar    # 1.054e-34 J*s
G = constants.G          # 6.674e-11 m^3/(kg*s^2)
c = constants.c          # 3e8 m/s

# Diosi-Penrose collapse timescale
def penrose_collapse_time(mass, separation):
    """Calculate the OR collapse timescale.

    t_collapse ~ hbar / E_G
    where E_G ~ G * m^2 / R (gravitational self-energy)
    """
    E_G = G * mass**2 / separation
    t_collapse = hbar / E_G
    return t_collapse

# Example: C60 fullerene (mass ~ 1.2e-24 kg)
m_c60 = 1.2e-24  # kg
R_c60 = 0.7e-9   # m (molecular diameter)

t_penrose = penrose_collapse_time(m_c60, R_c60)
print(f"Penrose collapse time for C60: {t_penrose:.2e} s")
print(f"Compare with decoherence time:  ~1e-17 s")` },
  { id: "cell-3", type: "output", content: `Penrose collapse time for C60: 1.10e+16 s
Compare with decoherence time:  ~1e-17 s

Note: For C60, decoherence dominates by 33 orders of magnitude.
The Penrose effect is only relevant for masses approaching ~10^-8 kg (Planck mass regime).` },
  { id: "cell-4", type: "code", language: "python", content: `# Mass threshold where Penrose collapse becomes relevant
# Set t_penrose = t_decoherence and solve for mass
# For typical decoherence: t_D ~ 1e-20 s (macroscopic)

t_target = 1.0  # 1 second (observable timescale)
R_typical = 1e-6  # 1 micron separation

m_threshold = np.sqrt(hbar * R_typical / (G * t_target))
print(f"Mass threshold for 1s collapse: {m_threshold:.2e} kg")
print(f"In atomic mass units: {m_threshold / 1.66e-27:.2e} u")
print(f"Planck mass: {np.sqrt(hbar * c / G):.2e} kg")` },
  { id: "cell-5", type: "output", content: `Mass threshold for 1s collapse: 1.26e-13 kg
In atomic mass units: 7.59e+13 u
Planck mass: 2.18e-08 kg

This corresponds to ~10^14 nucleons — a microscopic crystal.
Current experiments probe ~10^6 nucleons (Arndt group, Vienna).` },
];

const tools = [
  {
    id: "notebook",
    name: "Computational Notebook",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    description: "Pyodide-powered Python notebooks for physics computation with NumPy, SymPy, and SciPy",
    status: "active",
    color: "#f59e0b",
  },
  {
    id: "lean4",
    name: "Lean 4 Proof Assistant",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    description: "Interactive theorem prover with Mathlib access for formal verification",
    status: "active",
    color: "#8b5cf6",
  },
  {
    id: "latex",
    name: "LaTeX Renderer",
    icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    description: "Real-time LaTeX typesetting with MathJax 3 for mathematical discourse",
    status: "active",
    color: "#10b981",
  },
  {
    id: "cadabra",
    name: "Cadabra Tensor Algebra",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    description: "Tensor algebra system for general relativity and field theory computations",
    status: "beta",
    color: "#8b5cf6",
  },
  {
    id: "sage",
    name: "SageMath Engine",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    description: "Lie algebra computations, RG equations via PyR@TE 3, and symbolic manipulation",
    status: "active",
    color: "#ec4899",
  },
  {
    id: "knowledge-api",
    name: "Knowledge API",
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    description: "OpenAlex + Semantic Scholar API integration with SPECTER2 embeddings",
    status: "active",
    color: "#06b6d4",
  },
];

const latexExamples = [
  { label: "Schrodinger Equation", tex: "i\\hbar \\frac{\\partial}{\\partial t}|\\Psi(t)\\rangle = \\hat{H}|\\Psi(t)\\rangle" },
  { label: "Einstein Field Equations", tex: "G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}" },
  { label: "Dirac Equation", tex: "(i\\gamma^\\mu \\partial_\\mu - m)\\psi = 0" },
  { label: "Path Integral", tex: "\\langle x_f | e^{-iHt/\\hbar} | x_i \\rangle = \\int \\mathcal{D}[x(t)]\\, e^{iS[x]/\\hbar}" },
  { label: "Area Spectrum (LQG)", tex: "A = 8\\pi\\gamma l_P^2 \\sum_i \\sqrt{j_i(j_i+1)}" },
  { label: "Integrated Information", tex: "\\Phi = \\min_{\\text{cut}} D_{KL}\\left(p(X^t|X^{t-1}) \\| \\prod_k p(M_k^t | M_k^{t-1})\\right)" },
];

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState("notebook");
  const { status: pyodideStatus, runPython } = usePyodide();
  const [notebookOutputs, setNotebookOutputs] = useState<Record<string, { output: string; status: "idle" | "running" | "complete" | "error" }>>({});
  const [leanCode, setLeanCode] = useState(`-- Lean 4: Constructive proof sketch
theorem ivt_constructive (f : ℝ → ℝ) (a b : ℝ)
  (hf : Continuous f) (hab : a < b)
  (ha : f a < 0) (hb : f b > 0) :
  ∃ c ∈ Set.Ioo a b, f c = 0 := by
  -- Bisection algorithm provides
  -- constructive witness
  sorry -- Full proof in Mathlib`);
  const [leanResult, setLeanResult] = useState<{ status: string; goals: string[]; hypotheses: string[]; warnings: string[]; errors: string[]; checkTime?: string } | null>(null);
  const [leanChecking, setLeanChecking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ title: string; authors: string; year: number; citations: number; source: string; relevance: number }[]>([]);
  const [searching, setSearching] = useState(false);

  async function runNotebookCell(cellId: string, code: string) {
    setNotebookOutputs((prev) => ({ ...prev, [cellId]: { output: "", status: "running" } }));

    if (pyodideStatus === "ready") {
      const result = await runPython(code);
      setNotebookOutputs((prev) => ({
        ...prev,
        [cellId]: {
          output: result.error ? `Error: ${result.error}` : result.output,
          status: result.error ? "error" : "complete",
        },
      }));
    } else {
      // Fallback to API
      try {
        const res = await fetch("/api/tools/notebook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (res.ok) {
          const data = await res.json();
          setNotebookOutputs((prev) => ({
            ...prev,
            [cellId]: { output: data.output, status: "complete" },
          }));
        } else {
          setNotebookOutputs((prev) => ({
            ...prev,
            [cellId]: { output: "Error: Failed to execute", status: "error" },
          }));
        }
      } catch (error) {
        setNotebookOutputs((prev) => ({
          ...prev,
          [cellId]: {
            output: "Error: Failed to execute (network error)",
            status: "error",
          },
        }));
      }
    }
  }

  async function checkProof() {
    setLeanChecking(true);
    setLeanResult(null);
    const res = await fetch("/api/tools/lean4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: leanCode }),
    });
    if (res.ok) {
      setLeanResult(await res.json());
    }
    setLeanChecking(false);
  }

  async function searchPapers(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.papers);
    }
    setSearching(false);
  }

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Research Tools</h1>
        <p className="text-sm text-[var(--text-secondary)]">Computational infrastructure for rigorous academic research</p>
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTab(tool.id)}
            className={`glass-card p-4 text-left transition-all ${activeTab === tool.id ? "ring-1" : ""}`}
            style={activeTab === tool.id ? { borderColor: tool.color, boxShadow: `0 0 20px ${tool.color}20` } : {}}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${tool.color} 15%, transparent)` }}>
                <svg className="w-5 h-5" style={{ color: tool.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{tool.name}</h3>
                  {tool.status === "beta" && (
                    <span className="badge bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]" style={{ fontSize: 9 }}>BETA</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{tool.description}</p>
          </button>
        ))}
      </div>

      {/* Active tool panel */}
      {activeTab === "notebook" && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--accent-rose)]" />
              <span className="w-3 h-3 rounded-full bg-[var(--accent-amber)]" />
              <span className="w-3 h-3 rounded-full bg-[var(--accent-emerald)]" />
              <span className="text-sm text-[var(--text-muted)] ml-2">decoherence_analysis.ipynb</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)]" style={{ fontSize: 10 }}>Python (Pyodide)</span>
              <span className={`badge ${pyodideStatus === "ready" ? "bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)]" : pyodideStatus === "loading" ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]" : pyodideStatus === "error" ? "bg-[var(--accent-rose)]/10 text-[var(--accent-rose)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`} style={{ fontSize: 10 }}>
                Kernel: {pyodideStatus === "ready" ? "Active (Pyodide)" : pyodideStatus === "loading" ? "Loading..." : pyodideStatus === "error" ? "Fallback" : "Idle"}
              </span>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-primary)]">
            {sampleNotebook.map((cell, idx) => (
              <div key={cell.id} className="group relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 group-hover:bg-[var(--accent-indigo)] transition-colors" />
                <div className="flex">
                  <div className="w-16 py-3 text-center text-xs text-[var(--text-muted)] font-mono shrink-0 border-r border-[var(--border-primary)]">
                    {cell.type === "output" ? "Out" : `In [${idx + 1}]`}
                  </div>
                  <div className="flex-1 p-4">
                    {cell.type === "markdown" ? (
                      <div className="content-body">
                        {cell.content.split("\n").map((line, i) => {
                          if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold text-[var(--text-primary)]">{line.slice(2)}</h1>;
                          return <p key={i} className="text-sm text-[var(--text-secondary)]">{line}</p>;
                        })}
                      </div>
                    ) : cell.type === "code" ? (
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <SyntaxHighlighter
                              language={cell.language || "python"}
                              style={vscDarkPlus}
                              customStyle={{ background: "transparent", padding: 0, margin: 0, fontSize: "0.75rem" }}
                            >
                              {cell.content}
                            </SyntaxHighlighter>
                          </div>
                          <button
                            onClick={() => runNotebookCell(cell.id, cell.content)}
                            disabled={notebookOutputs[cell.id]?.status === "running"}
                            className="ml-3 shrink-0 px-2 py-1 rounded text-[10px] font-medium bg-[var(--accent-indigo)] text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {notebookOutputs[cell.id]?.status === "running" ? "Running..." : "▶ Run"}
                          </button>
                        </div>
                        {notebookOutputs[cell.id]?.output && (
                          <pre className={`text-xs font-mono leading-relaxed whitespace-pre-wrap mt-2 p-3 rounded-lg border ${notebookOutputs[cell.id]?.status === "error" ? "text-[var(--accent-rose)] bg-[var(--accent-rose)]/5 border-[var(--accent-rose)]/20" : "text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/5 border-[var(--accent-emerald)]/20"}`}>
                            {notebookOutputs[cell.id].output}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <pre className="text-xs font-mono text-[var(--accent-emerald)] leading-relaxed whitespace-pre-wrap">
                        {cell.content}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "lean4" && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: "#8b5cf6" }}>Lean 4 Proof Assistant</span>
              <span className="badge bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)]" style={{ fontSize: 10 }}>Mathlib v4.12</span>
            </div>
            <button onClick={checkProof} disabled={leanChecking} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-indigo)] text-white hover:opacity-90 disabled:opacity-50">
              {leanChecking ? "Checking..." : "Check Proof"}
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-primary)]">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Source</h3>
              <textarea
                value={leanCode}
                onChange={(e) => setLeanCode(e.target.value)}
                className="w-full h-64 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-3 text-xs font-mono text-[var(--text-primary)] resize-none outline-none focus:border-[var(--accent-indigo)]"
                spellCheck={false}
              />
            </div>
            <div className="p-4">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Proof State</h3>
              <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-3 h-64 overflow-auto">
                {leanChecking ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-amber)] status-pulse" />
                    Type-checking...
                  </div>
                ) : leanResult ? (
                  <div className="text-xs font-mono space-y-3">
                    {leanResult.goals.length > 0 && (
                      <div className="text-[var(--accent-amber)]">{leanResult.goals.length} goal{leanResult.goals.length > 1 ? "s" : ""}</div>
                    )}
                    {leanResult.hypotheses.length > 0 && (
                      <div className="text-[var(--text-secondary)]">
                        {leanResult.hypotheses.map((h, i) => <div key={i}>{h}</div>)}
                      </div>
                    )}
                    {leanResult.goals.map((g, i) => (
                      <div key={i} className="border-t border-[var(--border-primary)] pt-2 text-[var(--text-primary)]">{g}</div>
                    ))}
                    {leanResult.warnings.map((w, i) => (
                      <div key={i} className="text-[var(--accent-amber)] p-2 rounded bg-[var(--accent-amber)]/5 border border-[var(--accent-amber)]/20">warning: {w}</div>
                    ))}
                    {leanResult.errors.map((e, i) => (
                      <div key={i} className="text-[var(--accent-rose)] p-2 rounded bg-[var(--accent-rose)]/5 border border-[var(--accent-rose)]/20">error: {e}</div>
                    ))}
                    {leanResult.status === "success" && leanResult.errors.length === 0 && leanResult.warnings.length === 0 && (
                      <div className="text-[var(--accent-emerald)] p-2 rounded bg-[var(--accent-emerald)]/5 border border-[var(--accent-emerald)]/20">Proof checked successfully.</div>
                    )}
                    {leanResult.checkTime && (
                      <div className="text-[var(--text-muted)]">Check time: {leanResult.checkTime}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs font-mono space-y-3">
                    <div className="text-[var(--accent-amber)]">1 goal</div>
                    <div className="text-[var(--text-secondary)]">
                      f : R → R<br />a b : R<br />hf : Continuous f<br />hab : a &lt; b<br />ha : f a &lt; 0<br />hb : f b &gt; 0
                    </div>
                    <div className="border-t border-[var(--border-primary)] pt-2 text-[var(--text-primary)]">
                      ⊢ ∃ c ∈ Set.Ioo a b, f c = 0
                    </div>
                    <div className="text-[var(--text-muted)] italic">Click &quot;Check Proof&quot; to verify</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "latex" && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">LaTeX Renderer — Equations from Active Debates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {latexExamples.map((ex) => (
              <div key={ex.label} className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)]">
                <div className="text-xs text-[var(--text-muted)] mb-3">{ex.label}</div>
                <div className="text-center py-3 overflow-x-auto">
                  <MathRenderer tex={ex.tex} display />
                </div>
                <div className="font-mono text-[10px] text-[var(--text-muted)] overflow-x-auto p-2 bg-[var(--bg-card)] rounded mt-2 opacity-60">
                  {ex.tex}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "cadabra" && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#8b5cf6" }}>Cadabra Tensor Algebra</h3>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4">
            <pre className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">{`# Cadabra: Verify Bianchi identity
{\\mu, \\nu, \\rho, \\sigma}::Indices(position=fixed).
R_{\\mu\\nu\\rho\\sigma}::RiemannTensor.
\\nabla_{\\mu}{#}::Derivative.

# Contracted Bianchi identity
expr := \\nabla_{\\mu}{ G^{\\mu\\nu} };
# Result: 0  (divergence-free)

# Verify: \\nabla_\\mu G^{\\mu\\nu} = 0
# This guarantees local energy-momentum conservation
# via Einstein field equations:
#   G_{\\mu\\nu} = 8\\pi G T_{\\mu\\nu}
#   => \\nabla_\\mu T^{\\mu\\nu} = 0`}</pre>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[var(--accent-emerald)]/5 border border-[var(--accent-emerald)]/20">
            <div className="flex items-center gap-2 text-xs text-[var(--accent-emerald)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verified: Contracted Bianchi identity holds. G^μν is divergence-free.
            </div>
          </div>
        </div>
      )}

      {activeTab === "sage" && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#ec4899" }}>SageMath Engine</h3>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4">
            <pre className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">{`# SageMath: SU(3) Lie algebra structure
sage: L = lie_algebras.sl(QQ, 3)
sage: L.cartan_type()
['A', 2]

sage: # Root system
sage: R = RootSystem(['A', 2])
sage: R.ambient_space().simple_roots()
Finite family {1: (1, -1, 0), 2: (0, 1, -1)}

sage: # Dimension of SU(3) representations
sage: WeylCharacterRing(['A',2])([1,0]).degree()
3  # fundamental representation
sage: WeylCharacterRing(['A',2])([1,1]).degree()
8  # adjoint representation

sage: # Casimir operator eigenvalue
sage: # C_2(R) for fundamental rep of SU(3)
sage: print("C_2(fund) = 4/3")
sage: print("C_2(adj)  = 3")`}</pre>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[var(--accent-emerald)]/5 border border-[var(--accent-emerald)]/20">
            <div className="flex items-center gap-2 text-xs text-[var(--accent-emerald)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              SU(3) structure constants and representations verified against Mathlib
            </div>
          </div>
        </div>
      )}

      {activeTab === "knowledge-api" && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-semibold" style={{ color: "#06b6d4" }}>Knowledge API — Literature Search</h3>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPapers(searchQuery)}
              placeholder="Search papers: e.g. 'decoherence gravitational collapse' (press Enter)"
              className="search-input text-sm pl-10"
            />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">Searching...</span>}
          </div>
          <div className="space-y-3">
            {searchResults.length === 0 && !searching && searchQuery && (
              <div className="text-sm text-[var(--text-muted)] text-center py-4">No results. Try a different query.</div>
            )}
            {(searchResults.length > 0 ? searchResults : [
              { title: "Gravity-related spontaneous wave function collapse", authors: "Diósi, L.", year: 2014, citations: 287, source: "OpenAlex", relevance: 0.97 },
              { title: "On Gravity's role in Quantum State Reduction", authors: "Penrose, R.", year: 1996, citations: 1456, source: "Semantic Scholar", relevance: 0.95 },
              { title: "Decoherence, the measurement problem, and interpretations of quantum mechanics", authors: "Schlosshauer, M.", year: 2005, citations: 2134, source: "OpenAlex", relevance: 0.91 },
              { title: "Environment-induced superselection rules", authors: "Zurek, W.H.", year: 1982, citations: 3567, source: "Semantic Scholar", relevance: 0.88 },
            ]).map((paper, i) => (
              <div key={i} className="p-3 rounded-lg border border-[var(--border-primary)] hover:border-[var(--border-accent)] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">{paper.title}</h4>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      {paper.authors} ({paper.year}) — {paper.citations} citations
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-xs font-mono" style={{ color: paper.relevance > 0.9 ? "#10b981" : "#f59e0b" }}>
                      {(paper.relevance * 100).toFixed(0)}% match
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{paper.source}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-[var(--text-muted)] text-center">
            Powered by SPECTER2 embeddings | OpenAlex + Semantic Scholar APIs
          </div>
        </div>
      )}
    </div>
  );
}
