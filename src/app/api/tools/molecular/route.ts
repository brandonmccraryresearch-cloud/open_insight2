import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";
import { callMcpTool, MOLECULAR_MCP_SERVER } from "@/lib/mcpClient";

export const maxDuration = 120;

/**
 * Molecular Dynamics route — uses real scicomp-molecular-mcp binary via a
 * multi-step workflow (create_particles → add_potential → run_md), then falls
 * back to Gemini codeExecution.
 *
 * Real MCP tools (scicomp-molecular-mcp):
 *   create_particles, add_potential, run_md, run_nvt, run_npt,
 *   get_trajectory, compute_rdf, compute_msd, analyze_temperature,
 *   detect_phase_transition, density_field, render_trajectory,
 *   load_distribution, list_distributions, info
 *
 * Workflow:
 *   1. create_particles(n_particles, box_size, temperature) → system_id
 *   2. run_md(system_id, n_steps) OR run_nvt(system_id, n_steps, temperature)
 *   3. compute_rdf / compute_msd / analyze_temperature (optional analysis)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";
    const systemType = typeof body.systemType === "string" ? body.systemType.slice(0, 100) : "general";

    if (!task) {
      return NextResponse.json({ error: "task is required" }, { status: 400 });
    }

    // Try real MCP multi-step workflow
    try {
      const mcpResult = await runMolecularWorkflow(task, systemType);
      return NextResponse.json({
        tool: "scicomp-molecular-mcp",
        systemType,
        task: task.slice(0, 200),
        result: mcpResult,
        executionMode: "mcp",
      });
    } catch {
      // Fall through to Gemini
    }

    if (!hasGeminiKey()) {
      return NextResponse.json({ error: "Gemini API key not configured and MCP server unavailable" }, { status: 503 });
    }

    const text = await runGeminiFallback(task, systemType);
    return NextResponse.json({
      tool: "scicomp-molecular-mcp",
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

// ── Multi-step molecular workflow ─────────────────────────────────────────────

async function runMolecularWorkflow(task: string, systemType: string): Promise<string> {
  const taskLower = `${task} ${systemType}`.toLowerCase();

  // Step 1: Create particle system
  const createResult = await callMcpTool(MOLECULAR_MCP_SERVER, "create_particles", {
    n_particles: 64,
    box_size: [8.0, 8.0, 8.0],
    temperature: 300.0,
  });
  const createText = String(createResult.result);
  const sysIdMatch = createText.match(/['"]?(system:\/\/[a-f0-9-]+)['"]?/);
  if (!sysIdMatch) throw new Error("No system_id returned from create_particles");
  const systemId = sysIdMatch[1];

  // Step 2: Run simulation (NVT or NVE depending on task)
  const useNvt = /nvt|canonical|constant.temp|thermostat/.test(taskLower);
  const simTool = useNvt ? "run_nvt" : "run_md";
  const simParams = useNvt
    ? { system_id: systemId, n_steps: 500, temperature: 300.0, dt: 0.001 }
    : { system_id: systemId, n_steps: 500, dt: 0.001 };

  const simResult = await callMcpTool(MOLECULAR_MCP_SERVER, simTool, simParams);
  const simText = String(simResult.result);

  // Step 3: Optional analysis
  let analysisText = "";
  if (/rdf|radial distribution/.test(taskLower)) {
    const rdfResult = await callMcpTool(MOLECULAR_MCP_SERVER, "compute_rdf", { system_id: systemId, bins: 100 }).catch((err: unknown) => { console.warn("Optional compute_rdf failed:", err); return null; });
    if (rdfResult) analysisText += `\nRDF: ${String(rdfResult.result).slice(0, 500)}`;
  } else if (/msd|diffusion/.test(taskLower)) {
    const msdResult = await callMcpTool(MOLECULAR_MCP_SERVER, "compute_msd", { system_id: systemId }).catch((err: unknown) => { console.warn("Optional compute_msd failed:", err); return null; });
    if (msdResult) analysisText += `\nMSD: ${String(msdResult.result).slice(0, 500)}`;
  } else if (/temperature|thermo/.test(taskLower)) {
    const tempResult = await callMcpTool(MOLECULAR_MCP_SERVER, "analyze_temperature", { system_id: systemId }).catch((err: unknown) => { console.warn("Optional analyze_temperature failed:", err); return null; });
    if (tempResult) analysisText += `\nTemperature analysis: ${String(tempResult.result).slice(0, 500)}`;
  }

  return `Molecular dynamics complete (scicomp-molecular-mcp):\n` +
    `System: ${systemId} (64 particles, box 8Å³, T=300K)\n` +
    `Simulation (${simTool}, 500 steps): ${simText.slice(0, 1000)}` +
    analysisText;
}

async function runGeminiFallback(task: string, systemType: string): Promise<string> {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `You are a molecular dynamics simulation engine. Using Python with NumPy and SciPy, perform the following molecular dynamics task.

System type: ${systemType}
Task: ${task}

Available computations: Lennard-Jones MD, NVT/NVE/NPT ensembles, RDF, MSD, thermodynamic properties. Write and execute Python code. Show code and numerical results.`;

  const config = {
    ...REQUIRED_CONFIG,
    systemInstruction: "You are a molecular dynamics simulator. Execute Python code using NumPy/SciPy. Show code and results.",
  };
  enforceModelConfig(REQUIRED_MODEL, config);

  const response = await genai.models.generateContent({ model: REQUIRED_MODEL, config, contents: prompt });
  return typeof response.text === "string" ? response.text : "";
}

