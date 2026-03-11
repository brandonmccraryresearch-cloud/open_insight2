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
 * Neural Network MCP proxy — uses Gemini codeExecution to perform
 * neural network training, evaluation, and analysis using NumPy/SciPy.
 * Based on: scicomp-neural-mcp (16 tools for neural network training & evaluation).
 */
export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task.slice(0, 2000) : "";
    const architecture = typeof body.architecture === "string" ? body.architecture.slice(0, 100) : "";

    if (!task) {
      return NextResponse.json({ error: "task is required" }, { status: 400 });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `You are a neural network computation engine. Using Python with NumPy and standard ML libraries, perform the following neural network task.

Architecture: ${architecture || "as appropriate"}
Task: ${task}

Available computations include:
- Model architecture definition (feedforward, convolutional, recurrent)
- Forward and backward propagation
- Activation functions (ReLU, sigmoid, tanh, softmax)
- Loss function computation (MSE, cross-entropy, custom)
- Gradient descent optimization (SGD, Adam, RMSProp)
- Training loop execution with metrics tracking
- Model evaluation (accuracy, precision, recall, F1)
- Hyperparameter analysis
- Feature importance / gradient analysis
- Model export (weight serialization)

Write and execute Python code. Output both the code and results with analysis.`;

    const config = {
      ...REQUIRED_CONFIG,
      tools: [{ codeExecution: {} }],
      systemInstruction: "You are a neural network computation engine. Execute Python code using NumPy. Show code and results.",
    };
    enforceModelConfig(REQUIRED_MODEL, config);

    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents: prompt,
    });

    const text = typeof response.text === "string" ? response.text : "";

    return NextResponse.json({
      tool: "scicomp-neural-mcp",
      architecture: architecture || undefined,
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
