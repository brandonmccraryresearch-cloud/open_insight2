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
 * Molecular Dynamics MCP proxy — uses Gemini codeExecution to perform
 * classical molecular dynamics simulations using NumPy/SciPy.
 * Based on: scicomp-molecular-mcp (15 tools for classical molecular dynamics).
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
    const prompt = `You are a molecular dynamics simulation engine. Using Python with NumPy and SciPy, perform the following molecular dynamics task.

System type: ${systemType}
Task: ${task}

Available computations include:
- Particle system creation with configurable box size and temperature
- Lennard-Jones, Coulomb, and custom potential energy functions
- NVT/NVE/NPT ensemble simulations
- Velocity Verlet integration
- Radial distribution function (RDF) computation
- Mean squared displacement (MSD) and diffusion coefficients
- Temperature and pressure calculation
- Energy conservation analysis
- Thermodynamic property computation

Write and execute Python code for the simulation. Output both the code and numerical results with physical interpretation.`;

    const config = {
      ...REQUIRED_CONFIG,
      tools: [{ codeExecution: {} }],
      systemInstruction: "You are a molecular dynamics simulator. Execute Python code using NumPy/SciPy. Show code and results.",
    };
    enforceModelConfig(REQUIRED_MODEL, config);

    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents: prompt,
    });

    const text = typeof response.text === "string" ? response.text : "";

    return NextResponse.json({
      tool: "scicomp-molecular-mcp",
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
