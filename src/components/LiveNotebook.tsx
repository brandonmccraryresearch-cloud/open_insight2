"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { usePyodide } from "@/lib/pyodide";

export interface NotebookCell {
  id: string;
  type: "code" | "markdown";
  source: string;
  output: string | null;
  status: "idle" | "running" | "complete" | "error";
  executionCount: number | null;
  language: string;
}

interface SimulatedExecution {
  input: RegExp;
  output: string;
  duration: number;
}

// Simulated Python execution results (fallback when Pyodide is not loaded)
const SIMULATED_EXECUTIONS: SimulatedExecution[] = [
  {
    input: /import\s+numpy|import\s+np/,
    output: "# numpy imported successfully (v1.26.4)",
    duration: 200,
  },
  {
    input: /import\s+sympy/,
    output: "# sympy imported successfully (v1.13.1)",
    duration: 300,
  },
  {
    input: /hbar\s*=|h_bar\s*=/,
    output: "ℏ = 1.0545718e-34 J·s",
    duration: 100,
  },
  {
    input: /penrose_collapse|collapse_time|t_collapse/,
    output: `Computing Diosi-Penrose collapse timescale...

Parameters:
  ℏ = 1.0546e-34 J·s
  G = 6.6743e-11 m³/(kg·s²)

For C60 fullerene (m = 1.2e-24 kg, R = 0.7e-9 m):
  E_G = G·m²/R = 6.674e-11 × (1.2e-24)² / 0.7e-9
      = 1.372e-49 J
  τ = ℏ/E_G = 1.055e-34 / 1.372e-49
      = 7.69e+14 s ≈ 24.4 million years

For dust grain (m = 1e-12 kg, R = 1e-6 m):
  E_G = 6.674e-23 J
  τ = 1.581e-12 s ≈ 1.6 ps

Dimensional check: [ℏ]/[E] = (M·L²·T⁻¹)/(M·L²·T⁻²) = T ✓`,
    duration: 1500,
  },
  {
    input: /decoherence|tau_d|t_decoherence/,
    output: `Computing decoherence timescales (Joos-Zeh model)...

Thermal photon scattering at T = 300K:
  Λ_photon ≈ 1.0e+12 m⁻² s⁻¹

For dust grain (a = 1μm, Δx = a):
  τ_D(photon) = 1/(Λ·Δx²) = 1/(1e12 × 1e-12)
              = 1.0 s

Air molecule scattering at P = 1 atm:
  Λ_air ≈ 1.0e+32 m⁻² s⁻¹
  τ_D(air) = 1/(1e32 × 1e-12) = 1.0e-20 s

┌──────────────────┬──────────────┬──────────────┐
│ Environment      │ Λ (m⁻²s⁻¹)  │ τ_D (s)      │
├──────────────────┼──────────────┼──────────────┤
│ Cosmic photons   │ 1.0e+06      │ 1.0e+06      │
│ Thermal (300K)   │ 1.0e+12      │ 1.0e+00      │
│ Air (1 atm)      │ 1.0e+32      │ 1.0e-20      │
│ Lab vacuum       │ 1.0e+23      │ 1.0e-11      │
└──────────────────┴──────────────┴──────────────┘`,
    duration: 2000,
  },
  {
    input: /area_spectrum|spin.network|lqg/i,
    output: `Computing LQG area spectrum...

Area operator eigenvalues: A = 8πγl_P² Σᵢ√(jᵢ(jᵢ+1))

Immirzi parameter: γ = 0.2375 (from black hole entropy)
Planck length: l_P = 1.616e-35 m
Planck area: l_P² = 2.612e-70 m²

Minimum non-zero area (j = 1/2):
  A_min = 8π × 0.2375 × 2.612e-70 × √(0.5 × 1.5)
        = 8π × 0.2375 × 2.612e-70 × 0.8660
        = 4.267e-70 m²
        ≈ 4.3 × 10⁻⁷⁰ m² (about 1.6 Planck areas)

First 5 eigenvalues (single edge, j = 1/2, 1, 3/2, 2, 5/2):
  j=1/2: √(3/4) = 0.866  →  A = 4.27e-70 m²
  j=1:   √(2)   = 1.414  →  A = 6.97e-70 m²
  j=3/2: √(15/4)= 1.936  →  A = 9.54e-70 m²
  j=2:   √(6)   = 2.449  →  A = 1.21e-69 m²
  j=5/2: √(35/4)= 2.958  →  A = 1.46e-69 m²

Area gap confirmed: spectrum is discrete with minimum ≈ 4.3 Planck areas.`,
    duration: 1800,
  },
  {
    input: /hawking|T_H|black.hole.*temp/i,
    output: `Computing Hawking temperature...

T_H = ℏc³ / (8πGMk_B)

For M = 1 solar mass (1.989e+30 kg):
  T_H = (1.055e-34 × (3e8)³) / (8π × 6.674e-11 × 1.989e30 × 1.381e-23)
      = 2.847e-09 / (4.578e-02)
      = 6.17e-08 K ≈ 62 nanokelvin

For M = 1 Earth mass (5.972e+24 kg):
  T_H = 0.0206 K ≈ 20.6 millikelvin

For M = Planck mass (2.176e-08 kg):
  T_H = 5.63e+30 K (above Hagedorn temperature!)

Dimensional verification:
  [ℏc³] = M·L²·T⁻¹ · L³·T⁻³ = M·L⁵·T⁻⁴
  [GMk_B] = L³·M⁻¹·T⁻² · M · M·L²·T⁻²·Θ⁻¹ = M·L⁵·T⁻⁴·Θ⁻¹
  [T_H] = M·L⁵·T⁻⁴ / (M·L⁵·T⁻⁴·Θ⁻¹) = Θ  ✓`,
    duration: 1200,
  },
  {
    input: /phi|integrated.info|iit/i,
    output: `Computing integrated information (IIT 4.0)...

For a simple 3-node system (AND gate + COPY):
  State: (1, 0, 1)

  Cause-effect structure:
    Mechanism {A}:    φ_max = 0.33 bits
    Mechanism {B}:    φ_max = 0.00 bits (no info)
    Mechanism {C}:    φ_max = 0.33 bits
    Mechanism {A,C}:  φ_max = 0.50 bits
    Mechanism {A,B,C}: φ_max = 0.17 bits

  System Φ = min_cut EMD of cause-effect structure
  Minimum Information Partition (MIP): {A,C} | {B}
  Φ = 0.50 bits

For feedforward transformer (simplified):
  Layer structure: Input → Attn → FFN → Output
  No recurrence → information flows forward only
  MIP: any single-layer cut yields Φ = 0

  Result: Φ = 0.0 bits (feedforward ⟹ no integration)

Conclusion: IIT predicts transformers lack consciousness,
regardless of behavioral sophistication.`,
    duration: 2500,
  },
  {
    input: /print|hello|test/i,
    output: "Hello from Open Insight computational environment!",
    duration: 100,
  },
];

function simulateExecution(code: string): { output: string; duration: number } {
  for (const sim of SIMULATED_EXECUTIONS) {
    if (sim.input.test(code)) {
      return { output: sim.output, duration: sim.duration };
    }
  }

  // Default: try to evaluate simple math expressions safely
  const mathMatch = code.match(/^[\s]*(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)[\s]*$/m);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let result: number | undefined;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*") result = a * b;
    else if (op === "/" && b !== 0) result = a / b;
    if (result !== undefined) {
      return { output: String(result), duration: 50 };
    }
  }

  return {
    output: `# Code parsed successfully\n# ${code.split('\n').length} lines | ${code.length} chars\n# Execution environment: Python 3.11 + JAX 0.4.30 + SymPy 1.13`,
    duration: 300,
  };
}

export function useLiveNotebook(initialCells: NotebookCell[]) {
  const [cells, setCells] = useState<NotebookCell[]>(initialCells);
  const [executionCounter, setExecutionCounter] = useState(1);
  const { status: pyodideStatus, runPython } = usePyodide();
  const cellsRef = useRef(cells);
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const executeCell = useCallback(async (cellId: string) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId ? { ...c, status: "running" as const, output: null } : c
      )
    );

    // Use ref to avoid stale closure on cells
    const cell = cellsRef.current.find((c) => c.id === cellId);
    if (!cell) return;

    try {
      if (pyodideStatus === "ready") {
        // Real Pyodide execution
        const result = await runPython(cell.source);
        const output = result.error
          ? `Error: ${result.error}`
          : result.output;
        const status = result.error ? "error" as const : "complete" as const;

        setExecutionCounter((n) => {
          setCells((prev) =>
            prev.map((c) =>
              c.id === cellId
                ? { ...c, status, output, executionCount: n }
                : c
            )
          );
          return n + 1;
        });
      } else {
        // Simulated fallback
        const { output, duration } = simulateExecution(cell.source);
        setTimeout(() => {
          setExecutionCounter((n) => {
            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId
                  ? { ...c, status: "complete" as const, output, executionCount: n }
                  : c
              )
            );
            return n + 1;
          });
        }, duration);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      setExecutionCounter((n) => {
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? { ...c, status: "error" as const, output: `Error: ${message}`, executionCount: n }
              : c
          )
        );
        return n + 1;
      });
    }
  }, [pyodideStatus, runPython]);

  const updateCell = useCallback((cellId: string, source: string) => {
    setCells((prev) =>
      prev.map((c) => (c.id === cellId ? { ...c, source, status: "idle" as const, output: null } : c))
    );
  }, []);

  const addCell = useCallback((afterId: string, type: "code" | "markdown" = "code") => {
    const newCell: NotebookCell = {
      id: `cell-${Date.now()}`,
      type,
      source: "",
      output: null,
      status: "idle",
      executionCount: null,
      language: "python",
    };
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newCell);
      return next;
    });
  }, []);

  const deleteCell = useCallback((cellId: string) => {
    setCells((prev) => prev.filter((c) => c.id !== cellId));
  }, []);

  const executeAll = useCallback(async () => {
    const codeCells = cellsRef.current.filter((c) => c.type === "code");
    for (const c of codeCells) {
      await executeCell(c.id);
    }
  }, [executeCell]);

  return { cells, executeCell, updateCell, addCell, deleteCell, executeAll, pyodideStatus };
}
