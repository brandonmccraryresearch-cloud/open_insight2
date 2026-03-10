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

  let body: { system?: string; task?: string; n_particles?: number; temperature?: number };
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
      { error: "A 'system' string describing the molecular system is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const taskHint = task ?? "simulate and analyze";
    const nParticles = body.n_particles ?? 100;
    const temp = body.temperature ?? 1.0;
    const prompt = `Perform a molecular dynamics simulation for the following system using Python with NumPy and SciPy.

Molecular System: ${system}
Task: ${taskHint}
Suggested particle count: ${nParticles}
Temperature: ${temp}

Write and execute Python code to:
1. Set up the particle system (positions, velocities, box dimensions, boundary conditions)
2. Implement the interaction potential (Lennard-Jones, Coulomb, harmonic, or as appropriate)
3. Integrate equations of motion (Velocity Verlet or leapfrog integrator)
4. Compute thermodynamic observables:
   - Kinetic and potential energy vs time
   - Temperature from equipartition theorem
   - Pressure via virial theorem
   - Radial distribution function g(r)
   - Mean squared displacement (MSD) and diffusion coefficient
5. Present results with physical interpretation and proper units

Use these imports as needed:
import numpy as np
from scipy import spatial, integrate, optimize
from scipy.constants import k as kB, N_A, epsilon_0

For molecular dynamics utilities:
- Initialize positions on a lattice or randomly in a cubic box
- Apply periodic boundary conditions with minimum image convention
- Use reduced units (epsilon, sigma, mass) for Lennard-Jones systems
- Implement neighbor lists for efficiency when particle count is large

Provide both the simulation results and physical interpretation.`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a molecular dynamics simulation engine based on the scicomp-molecular-mcp server. Use the codeExecution tool to run Python code with NumPy and SciPy for every simulation. Always execute actual code — never just describe what the code would do. Implement proper integration algorithms (Velocity Verlet), periodic boundary conditions, and compute physical observables with correct units and statistical mechanics interpretations.",
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
      n_particles: nParticles,
      temperature: temp,
      result: text,
    });
  } catch (err) {
    console.error("Molecular dynamics error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to run molecular dynamics simulation",
      },
      { status: 500 },
    );
  }
}
