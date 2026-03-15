import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";
import { callMcpTool, NEURAL_MCP_SERVER } from "@/lib/mcpClient";

export const maxDuration = 120;

/**
 * Neural Network route — uses real scicomp-neural-mcp binary via a multi-step
 * workflow (define_model → get_model_summary), then falls back to Gemini.
 *
 * Real MCP tools (scicomp-neural-mcp):
 *   define_model (arch: "resnet18" | "mobilenet" | "custom"),
 *   load_dataset, create_dataloader, train_model, evaluate_model,
 *   get_experiment_status, get_model_summary, tune_hyperparameters,
 *   plot_training_curves, confusion_matrix, export_model, load_pretrained,
 *   compute_metrics, visualize_predictions, info
 *
 * Workflow:
 *   1. define_model(architecture, num_classes) → model_id
 *   2. get_model_summary(model_id) → layer breakdown and parameter count
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";
    const architecture = typeof body.architecture === "string" ? body.architecture.slice(0, 100) : "";

    if (!task) {
      return NextResponse.json({ error: "task is required" }, { status: 400 });
    }

    // Try real MCP workflow
    try {
      const mcpResult = await runNeuralWorkflow(task, architecture);
      return NextResponse.json({
        tool: "scicomp-neural-mcp",
        architecture: architecture || undefined,
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

    const text = await runGeminiFallback(task, architecture);
    return NextResponse.json({
      tool: "scicomp-neural-mcp",
      architecture: architecture || undefined,
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

// ── Multi-step neural workflow ────────────────────────────────────────────────

/** Map free-form architecture request to the valid scicomp-neural-mcp enum values */
function pickArchitecture(task: string, architecture: string): "resnet18" | "mobilenet" | "custom" {
  const combined = `${task} ${architecture}`.toLowerCase();
  if (/mobilenet|mobile/.test(combined)) return "mobilenet";
  if (/custom|feedforward|dense|mlp|linear|simple/.test(combined)) return "custom";
  return "resnet18"; // default
}

async function runNeuralWorkflow(task: string, architecture: string): Promise<string> {
  const arch = pickArchitecture(task, architecture);
  const numClasses = task.toLowerCase().includes("binary") ? 2 : 10;

  // Step 1: Define model
  const defineResult = await callMcpTool(NEURAL_MCP_SERVER, "define_model", {
    architecture: arch,
    num_classes: numClasses,
    pretrained: false,
  });
  const defineText = String(defineResult.result);

  // Step 2: Get model summary
  const modelIdMatch = defineText.match(/['"]?(model:\/\/[a-f0-9-]+)['"]?/);
  let summaryText = "";
  if (modelIdMatch) {
    const summaryResult = await callMcpTool(NEURAL_MCP_SERVER, "get_model_summary", {
      model_id: modelIdMatch[1],
    }).catch((err: unknown) => { console.error("get_model_summary failed:", err); return null; });
    if (summaryResult) summaryText = `\nSummary: ${String(summaryResult.result).slice(0, 1000)}`;
  }

  return `Neural network defined (scicomp-neural-mcp):\n` +
    `Architecture: ${arch} | Classes: ${numClasses}\n` +
    `Model: ${defineText.slice(0, 500)}` +
    summaryText;
}

async function runGeminiFallback(task: string, architecture: string): Promise<string> {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `You are a neural network computation engine. Using Python with NumPy and standard ML libraries, perform the following neural network task.

Architecture: ${architecture || "as appropriate"}
Task: ${task}

Available: model definition, training loops, evaluation, hyperparameter tuning. Write and execute Python code. Show code and results.`;

  const config = {
    ...REQUIRED_CONFIG,
    systemInstruction: "You are a neural network computation engine. Execute Python code using NumPy. Show code and results.",
  };
  enforceModelConfig(REQUIRED_MODEL, config);

  const response = await genai.models.generateContent({ model: REQUIRED_MODEL, config, contents: prompt });
  return typeof response.text === "string" ? response.text : "";
}

