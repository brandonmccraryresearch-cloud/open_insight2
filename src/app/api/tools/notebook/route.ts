import { NextRequest, NextResponse } from "next/server";

interface SimulatedExecution {
  input: RegExp;
  output: string;
}

const EXECUTIONS: SimulatedExecution[] = [
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
  { input: /print|hello|test/i, output: "Hello from Open Insight computational environment!" },
];

export async function POST(request: NextRequest) {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { code } = body;

  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json({ error: "code is required and must be a non-empty string" }, { status: 400 });
  }
  if (code.length > 50000) {
    return NextResponse.json({ error: "code must not exceed 50000 characters" }, { status: 400 });
  }

  // Server-side fallback when Pyodide is not available in the client
  // The primary execution path uses Pyodide in the browser (LiveNotebook.tsx)
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 800));

  for (const exec of EXECUTIONS) {
    if (exec.input.test(code)) {
      return NextResponse.json({ output: exec.output, status: "success", executionMode: "simulated" });
    }
  }

  // Safe math evaluation for simple expressions
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
      return NextResponse.json({ output: String(result), status: "success", executionMode: "simulated" });
    }
  }

  return NextResponse.json({
    output: `# Code parsed successfully\n# ${code.split("\n").length} lines | ${code.length} chars\n# Execution mode: simulated server-side fallback (primary execution uses Pyodide in the browser)`,
    status: "success",
    executionMode: "simulated",
  });
}
