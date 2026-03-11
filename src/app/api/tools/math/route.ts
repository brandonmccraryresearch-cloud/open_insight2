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
 * Math MCP proxy — uses Gemini codeExecution to perform symbolic algebra and
 * numerical computing using SymPy/NumPy/SciPy.
 * Based on: scicomp-math-mcp (14 tools for symbolic algebra + numerical computing).
 */
export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const operation = typeof body.operation === "string" ? body.operation.slice(0, 200) : "";
    const expression = typeof body.expression === "string" ? body.expression.slice(0, 2000) : "";
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";

    const description = task || `${operation}: ${expression}`.trim();
    if (!description || description === ":") {
      return NextResponse.json({ error: "task, or operation+expression is required" }, { status: 400 });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `You are a computational mathematics engine. Using Python with SymPy for symbolic computation and NumPy/SciPy for numerical methods, perform the following mathematical task.

Task: ${description}

Available operations include:
- Symbolic: differentiation, integration, equation solving, series expansion, simplification, factoring, limits
- Linear algebra: matrix operations, eigenvalues, SVD, determinants
- Numerical: ODE solving, optimization, interpolation, numerical integration
- Number theory: primality, factorization, modular arithmetic
- Calculus: multivariate calculus, vector calculus, differential forms

Write and execute Python code. Output both the code and the result.`;

    const config = {
      ...REQUIRED_CONFIG,
      tools: [{ codeExecution: {} }],
      systemInstruction: "You are a symbolic and numerical math engine. Execute Python code using SymPy/NumPy/SciPy. Show code and results.",
    };
    enforceModelConfig(REQUIRED_MODEL, config);

    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents: prompt,
    });

    const text = typeof response.text === "string" ? response.text : "";

    return NextResponse.json({
      tool: "scicomp-math-mcp",
      operation: operation || undefined,
      expression: expression ? expression.slice(0, 200) : undefined,
      result: text.slice(0, 8000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
