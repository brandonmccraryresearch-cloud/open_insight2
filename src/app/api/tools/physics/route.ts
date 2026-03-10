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

  let body: { problem?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { problem, domain } = body;
  if (!problem || typeof problem !== "string") {
    return NextResponse.json(
      { error: "A 'problem' string is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const domainHint = domain ?? "general physics";
    const prompt = `Solve the following computational physics problem using Python with NumPy, SciPy, and SymPy.

Domain: ${domainHint}
Problem: ${problem}

Write and execute Python code to:
1. Set up the physical/mathematical model
2. Perform the numerical or symbolic computation
3. Present results with proper units and physical interpretation
4. Include relevant physical constants from scipy.constants where applicable

Use these imports as needed:
import numpy as np
from scipy import constants, integrate, optimize, linalg, special
from sympy import *

Provide both the computational result and a clear physics interpretation.`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a computational physics engine. Use the codeExecution tool to run Python code with NumPy, SciPy, and SymPy for every physics computation. Always execute actual code — never just describe what the code would do. Include proper physical units, constants, and dimensional analysis in your results.",
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
      problem,
      domain: domainHint,
      result: text,
    });
  } catch (err) {
    console.error("Physics computation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to compute physics problem",
      },
      { status: 500 },
    );
  }
}
