import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: { system?: string; task?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { system, task } = body;
  if (!system || typeof system !== "string") {
    return NextResponse.json(
      { error: "A 'system' string describing the quantum system is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const taskHint = task ?? "simulate and analyze";
    const prompt = `Simulate and analyze the following quantum system using Python with NumPy and SciPy.

Quantum System: ${system}
Task: ${taskHint}

Write and execute Python code to:
1. Define the quantum system (Hilbert space, Hamiltonian, initial state)
2. Perform the simulation (time evolution, eigenvalue computation, measurement probabilities)
3. Compute relevant quantum observables (expectation values, entanglement entropy, fidelity)
4. Present results with physical interpretation

Use these imports as needed:
import numpy as np
from scipy import linalg, integrate, sparse
from numpy import kron, eye, array, sqrt, exp, pi

For quantum mechanics utilities:
- Use Pauli matrices: sigma_x, sigma_y, sigma_z
- Use creation/annihilation operators where appropriate
- Compute density matrices and von Neumann entropy
- Show probability amplitudes and measurement outcomes

Provide both the numerical results and quantum mechanical interpretation.`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a quantum physics simulation engine. Use the codeExecution tool to run Python code with NumPy and SciPy for every quantum simulation. Always execute actual code — never just describe what the code would do. Use proper Dirac notation and quantum mechanical formalism. Include state vectors, density matrices, and observable expectation values in your output.",
    };
    enforceModelConfig(REQUIRED_MODEL, config);

    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    return NextResponse.json({
      system,
      task: taskHint,
      result: text,
    });
  } catch (err) {
    console.error("Quantum simulation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to simulate quantum system",
      },
      { status: 500 },
    );
  }
}
