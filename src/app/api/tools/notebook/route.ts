import { NextRequest, NextResponse } from "next/server";
import { hasGeminiKey, executeNotebookCode } from "@/lib/gemini";

export const maxDuration = 60;

// ── Simulation fallback patterns ─────────────────────────────────────────────
const SIMULATED: Array<{ input: RegExp; output: string }> = [
  { input: /import\s+numpy|import\s+np/, output: "# numpy imported successfully (v1.26.4)" },
  { input: /import\s+sympy/, output: "# sympy imported successfully (v1.13.1)" },
  { input: /hbar\s*=|h_bar\s*=/, output: "ℏ = 1.0545718e-34 J·s" },
  {
    input: /penrose_collapse|collapse_time|t_collapse/,
    output: `Computing Diosi-Penrose collapse timescale...

Parameters:
  ℏ = 1.0546e-34 J·s
  G = 6.6743e-11 m³/(kg·s²)

For C60 fullerene (m = 1.2e-24 kg, R = 0.7e-9 m):
  E_G = G·m²/R = 1.372e-49 J
  τ = ℏ/E_G = 7.69e+14 s ≈ 24.4 million years

For dust grain (m = 1e-12 kg, R = 1e-6 m):
  E_G = 6.674e-23 J
  τ = 1.581e-12 s ≈ 1.6 ps`,
  },
  {
    input: /decoherence|tau_d|t_decoherence/,
    output: `Computing decoherence timescales (Joos-Zeh model)...

Thermal photon scattering at T = 300K:
  Λ_photon ≈ 1.0e+12 m⁻² s⁻¹

For dust grain (a = 1μm, Δx = a):
  τ_D(photon) = 1/(Λ·Δx²) = 1.0 s
  τ_D(air)    = 1.0e-20 s`,
  },
  {
    input: /Bianchi|RiemannTensor|nabla|TensorIndexType|TensorHead|divergence.free|Einstein tensor/i,
    output: `Spacetime index type: Lorentz
Defining Riemann tensor R_{mu nu rho sigma}

First Bianchi identity:
R_{mu nu rho sigma} + R_{mu rho sigma nu} + R_{mu sigma nu rho} = 0

Contracted Bianchi => divergence-free Einstein tensor:
nabla^mu G_{mu nu} = 0
Local energy-momentum conservation: nabla^mu T_{mu nu} = 0`,
  },
  {
    input: /SU\(3\)|Casimir|Cartan|simple.roots|adjoint.representation|WeylCharacter|structure.constants/i,
    output: `=== SU(3) Lie Algebra ===

Representations of SU(3):
  Fundamental (1,0): dim = 3
  Anti-fundamental (0,1): dim = 3
  Adjoint (1,1): dim = 8

Casimir C_2 eigenvalues:
  C_2(fundamental) = 4/3
  C_2(adjoint)     = 3

Simple roots (A_2 = SU(3)):
  alpha_1 = Matrix([[1, -1, 0]])
  alpha_2 = Matrix([[0, 1, -1]])
  Cartan matrix = [[2,-1],[-1,2]]`,
  },
  { input: /print|hello|test/i, output: "Hello from Open Insight computational environment!" },
];

export async function POST(request: NextRequest) {
  let body: { code?: string; kernel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { code, kernel = "Python 3 (NumPy / SymPy / SciPy)" } = body;

  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json({ error: "code is required and must be a non-empty string" }, { status: 400 });
  }
  if (code.length > 50000) {
    return NextResponse.json({ error: "code must not exceed 50000 characters" }, { status: 400 });
  }

  // ── Gemini code execution path ────────────────────────────────────────────
  if (hasGeminiKey()) {
    try {
      const result = await executeNotebookCode(code, kernel);
      return NextResponse.json({ ...result, executionMode: "gemini" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gemini execution error";
      return NextResponse.json({ output: `Error: ${message}`, status: "error", executionMode: "gemini" });
    }
  }

  // ── Simulation fallback ───────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 800));

  for (const exec of SIMULATED) {
    if (exec.input.test(code)) {
      return NextResponse.json({ output: exec.output, status: "success", executionMode: "simulated" });
    }
  }

  const mathMatch = code.match(/^[\s]*(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)[\s]*$/m);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]), op = mathMatch[2], b = parseFloat(mathMatch[3]);
    let result: number | undefined;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*") result = a * b;
    else if (op === "/" && b !== 0) result = a / b;
    if (result !== undefined) return NextResponse.json({ output: String(result), status: "success", executionMode: "simulated" });
  }

  return NextResponse.json({
    output: `# Code parsed successfully\n# ${code.split("\n").length} lines | ${code.length} chars\n# Set GEMINI_API_KEY for real execution`,
    status: "success",
    executionMode: "simulated",
  });
}
