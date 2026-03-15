import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";
import { callMcpTool, MATH_MCP_SERVER } from "@/lib/mcpClient";

export const maxDuration = 120;

/**
 * Math MCP route — tries the real scicomp-math-mcp binary first (JSON-RPC
 * over stdio), then falls back to Gemini codeExecution when the binary is
 * unavailable (e.g. Vercel serverless).
 *
 * Real MCP tools available (scicomp-math-mcp v1.26.0):
 *   symbolic_solve, symbolic_diff, symbolic_integrate, symbolic_simplify,
 *   create_array, matrix_multiply, solve_linear_system, fft, ifft,
 *   optimize_function, find_roots, info
 *
 * Response includes `executionMode: "mcp" | "gemini"` so callers can tell
 * which path was taken.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const operation = typeof body.operation === "string" ? body.operation.slice(0, 200) : "";
    const expression = typeof body.expression === "string" ? body.expression.slice(0, 2000) : "";
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";

    const description = task || `${operation}: ${expression}`.trim();
    if (!description || description === ":") {
      return NextResponse.json({ error: "task, or operation+expression is required" }, { status: 400 });
    }

    // ── Choose tool name based on operation keyword ──────────────────────────
    const mcpTool = pickMathTool(operation, expression, task);
    const mcpParams = buildMathParams(mcpTool, operation, expression, task);

    // ── MCP first; Gemini fallback ───────────────────────────────────────────
    const { result, executionMode } = await callMcpTool(
      MATH_MCP_SERVER,
      mcpTool,
      mcpParams,
      hasGeminiKey() ? () => runGeminiFallback(description) : undefined,
    );

    if (!hasGeminiKey() && executionMode === "gemini") {
      return NextResponse.json({ error: "Gemini API key not configured and MCP server unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      tool: "scicomp-math-mcp",
      mcpTool: executionMode === "mcp" ? mcpTool : undefined,
      operation: operation || undefined,
      expression: expression ? expression.slice(0, 200) : undefined,
      result: String(result).slice(0, 8000),
      executionMode,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick the best scicomp-math-mcp tool for the given request */
function pickMathTool(operation: string, expression: string, task: string): string {
  const combined = `${operation} ${expression} ${task}`.toLowerCase();
  if (/integrat|integral/.test(combined)) return "symbolic_integrate";
  if (/differenti|deriv/.test(combined)) return "symbolic_diff";
  if (/solv|equation/.test(combined)) return "symbolic_solve";
  if (/simplif/.test(combined)) return "symbolic_simplify";
  if (/matrix|linear system/.test(combined)) return "solve_linear_system";
  if (/multiply|matmul/.test(combined)) return "matrix_multiply";
  if (/fft|fourier/.test(combined)) return "fft";
  if (/root|zero/.test(combined)) return "find_roots";
  if (/optim|minim|maxim/.test(combined)) return "optimize_function";
  // Default: symbolic differentiation (general symbolic task)
  return "symbolic_diff";
}

/** Build parameters for the chosen MCP tool */
function buildMathParams(
  tool: string,
  operation: string,
  expression: string,
  task: string,
): Record<string, unknown> {
  switch (tool) {
    case "symbolic_integrate":
      return { expression: expression || task, variable: guessVariable(expression || task) };
    case "symbolic_diff":
      return { expression: expression || task, variable: guessVariable(expression || task) };
    case "symbolic_solve":
      return { equations: expression || task, variables: [guessVariable(expression || task)] };
    case "symbolic_simplify":
      return { expression: expression || task };
    default:
      return { expression: expression || operation || task, variable: guessVariable(expression || task) };
  }
}

/** Heuristically guess the primary variable from an expression */
function guessVariable(expr: string): string {
  // Match multi-character variable names (e.g., theta, alpha, x1) first,
  // then fall back to single-letter variables commonly used in math.
  const match = expr.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?=\s*[\^*\/+\-]|\s*$)/);
  if (match) return match[1];
  // Common single-letter fallbacks in priority order
  for (const v of ["x", "t", "r", "z", "y", "u", "v"]) {
    if (new RegExp(`\\b${v}\\b`).test(expr)) return v;
  }
  return "x";
}

/** Gemini codeExecution fallback */
async function runGeminiFallback(description: string): Promise<string> {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `You are a computational mathematics engine. Using Python with SymPy for symbolic computation and NumPy/SciPy for numerical methods, perform the following mathematical task.

Task: ${description}

Available operations: differentiation, integration, equation solving, series expansion, simplification, factoring, limits, matrix operations, ODE solving, optimization.

Write and execute Python code. Output both the code and the result.`;

  const config = {
    ...REQUIRED_CONFIG,
    systemInstruction: "You are a symbolic and numerical math engine. Execute Python code using SymPy/NumPy/SciPy. Show code and results.",
  };
  enforceModelConfig(REQUIRED_MODEL, config);

  const response = await genai.models.generateContent({
    model: REQUIRED_MODEL,
    config,
    contents: prompt,
  });
  return typeof response.text === "string" ? response.text : "";
}
