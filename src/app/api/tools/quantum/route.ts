import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";

export const maxDuration = 120;

/**
 * Quantum Physics Simulation proxy — uses Gemini codeExecution to run
 * quantum physics simulations using NumPy/SciPy.
 * Based on: PsiAnimator-MCP (QuTip + Manim quantum simulation) and
 * scicomp-quantum-mcp (12 tools for wave mechanics & Schrödinger simulations).
 */
export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";
    const systemType = typeof body.systemType === "string" ? body.systemType.slice(0, 100) : "general";

    if (!task) {
      return NextResponse.json({ error: "task is required" }, { status: 400 });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `You are a quantum physics simulation engine. Using Python with NumPy, SciPy, and standard quantum mechanics libraries, perform the following quantum computation task.

System type: ${systemType}
Task: ${task}

Write and execute Python code to:
1. Set up the quantum system (Hilbert space, states, operators)
2. Perform the requested computation (time evolution, measurements, entanglement analysis, etc.)
3. Return numerical results with physical interpretation

Supported computations include:
- Quantum state creation (pure, mixed, coherent, squeezed, thermal, Fock)
- Time evolution (Schrödinger equation, master equation)
- Measurement (expectation values, probabilities, correlations)
- Entanglement measures (von Neumann entropy, concurrence, negativity)
- Quantum gate operations (Pauli, Hadamard, CNOT, custom unitaries)
- Wave function analysis (probability densities, momentum space)

Output both the Python code used and the numerical results.`;

    const config = {
      ...REQUIRED_CONFIG,
      tools: [{ codeExecution: {} }],
      systemInstruction: "You are a quantum physics simulator. Execute Python code for quantum mechanics computations. Always show the code and results.",
    };
    enforceModelConfig(REQUIRED_MODEL, config);

    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents: prompt,
    });

    const text = typeof response.text === "string" ? response.text : "";

    return NextResponse.json({
      tool: "psianimator-mcp / scicomp-quantum-mcp",
      systemType,
      task: task.slice(0, 200),
      result: text.slice(0, 8000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
