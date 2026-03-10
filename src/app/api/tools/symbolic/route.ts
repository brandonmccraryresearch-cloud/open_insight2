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

  let body: { expression?: string; operation?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { expression, operation } = body;
  if (!expression || typeof expression !== "string") {
    return NextResponse.json(
      { error: "An 'expression' string is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const op = operation ?? "simplify and analyze";
    const prompt = `Perform symbolic algebra on the following expression using Python with SymPy.

Operation requested: ${op}
Expression: ${expression}

Write and execute Python code using SymPy to:
1. Parse the expression symbolically
2. Perform the requested operation (simplify, expand, factor, differentiate, integrate, solve, series expand, etc.)
3. Show the step-by-step symbolic result
4. Provide mathematical interpretation

Use these imports: from sympy import *

Return the complete symbolic result with LaTeX representation where applicable.`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a symbolic algebra computation engine. Use the codeExecution tool to run Python/SymPy code for every request. Always execute actual code — never just describe what the code would do. Return both the raw symbolic result and a human-readable mathematical explanation.",
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

    return NextResponse.json({ expression, operation: op, result: text });
  } catch (err) {
    console.error("Symbolic algebra error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to compute symbolic algebra",
      },
      { status: 500 },
    );
  }
}
