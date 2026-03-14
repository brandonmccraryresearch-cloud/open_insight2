import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";
import { callMcpTool, QUANTUM_MCP_SERVER } from "@/lib/mcpClient";

export const maxDuration = 120;

/**
 * Quantum Physics Simulation route — uses real scicomp-quantum-mcp binary via
 * a multi-step workflow (create wavepacket → solve Schrödinger), then falls
 * back to Gemini codeExecution when the binary is unavailable.
 *
 * Real MCP tools (scicomp-quantum-mcp):
 *   create_gaussian_wavepacket, create_plane_wave, create_lattice_potential,
 *   create_custom_potential, solve_schrodinger, solve_schrodinger_2d,
 *   analyze_wavefunction, get_task_status, get_simulation_result,
 *   render_video, visualize_potential, info
 *
 * Workflow:
 *   1. create_gaussian_wavepacket → wavefunction_id
 *   2. create_custom_potential → potential_id
 *   3. solve_schrodinger(initial_state, potential, time_steps) → simulation result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";
    const systemType = typeof body.systemType === "string" ? body.systemType.slice(0, 100) : "general";

    if (!task) {
      return NextResponse.json({ error: "task is required" }, { status: 400 });
    }

    // Try the real MCP multi-step workflow
    try {
      const mcpResult = await runQuantumWorkflow(task, systemType);
      return NextResponse.json({
        tool: "psianimator-mcp / scicomp-quantum-mcp",
        systemType,
        task: task.slice(0, 200),
        result: mcpResult,
        executionMode: "mcp",
      });
    } catch {
      // Fall through to Gemini fallback
    }

    if (!hasGeminiKey()) {
      return NextResponse.json({ error: "Gemini API key not configured and MCP server unavailable" }, { status: 503 });
    }

    const text = await runGeminiFallback(task, systemType);
    return NextResponse.json({
      tool: "psianimator-mcp / scicomp-quantum-mcp",
      systemType,
      task: task.slice(0, 200),
      result: text.slice(0, 8000),
      executionMode: "gemini",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ── Multi-step quantum workflow ───────────────────────────────────────────────

async function runQuantumWorkflow(task: string, systemType: string): Promise<string> {
  const taskLower = `${task} ${systemType}`.toLowerCase();

  // Step 1: Create wavefunction (Gaussian or plane wave)
  const useGaussian = !/plane wave/.test(taskLower);
  const wfTool = useGaussian ? "create_gaussian_wavepacket" : "create_plane_wave";
  const wfParams = useGaussian
    ? { grid_size: [256], position: [0.0], momentum: [5.0], width: 1.0 }
    : { grid_size: [256], momentum: [5.0] };

  const wfResult = await callMcpTool(QUANTUM_MCP_SERVER, wfTool, wfParams);
  const wfText = String(wfResult.result);
  const wfIdMatch = wfText.match(/['"]?(wavefunction:\/\/[a-f0-9-]+)['"]?/);
  if (!wfIdMatch) throw new Error(`No wavefunction_id found in MCP response: ${wfText.slice(0, 200)}`);
  const wavefunctionId = wfIdMatch[1];

  // Step 2: Create potential (harmonic oscillator by default)
  const potParams = {
    potential_function: "0.5 * x**2",
    grid_size: [256],
    x_range: [-10.0, 10.0],
  };
  const potResult = await callMcpTool(QUANTUM_MCP_SERVER, "create_custom_potential", potParams);
  const potText = String(potResult.result);
  const potIdMatch = potText.match(/['"]?(potential:\/\/[a-f0-9-]+)['"]?/);
  const potentialId = potIdMatch?.[1] ?? "free";

  // Step 3: Solve Schrödinger equation
  const timeSteps = /fast|quick/.test(taskLower) ? 50 : 100;
  const solveParams = {
    potential: potentialId,
    initial_state: [wavefunctionId],
    time_steps: timeSteps,
    dt: 0.01,
  };
  const solveResult = await callMcpTool(QUANTUM_MCP_SERVER, "solve_schrodinger", solveParams);
  const solveText = String(solveResult.result);

  return `Quantum simulation complete (scicomp-quantum-mcp):\n` +
    `Wavefunction: ${wfIdMatch[1]}\n` +
    `Potential: ${potentialId}\n` +
    `Evolution: ${solveText.slice(0, 2000)}`;
}

async function runGeminiFallback(task: string, systemType: string): Promise<string> {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `You are a quantum physics simulation engine. Using Python with NumPy, SciPy, and standard quantum mechanics libraries, perform the following quantum computation task.

System type: ${systemType}
Task: ${task}

Write and execute Python code to set up the quantum system, perform the computation, and return numerical results with physical interpretation.`;

  const config = {
    ...REQUIRED_CONFIG,
    systemInstruction: "You are a quantum physics simulator. Execute Python code for quantum mechanics computations. Always show the code and results.",
  };
  enforceModelConfig(REQUIRED_MODEL, config);

  const response = await genai.models.generateContent({ model: REQUIRED_MODEL, config, contents: prompt });
  return typeof response.text === "string" ? response.text : "";
}
