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

  let body: { task?: string; architecture?: string; dataset?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { task, architecture } = body;
  if (!task || typeof task !== "string") {
    return NextResponse.json(
      { error: "A 'task' string describing the neural network task is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const archHint = architecture ?? "appropriate architecture";
    const datasetHint = body.dataset ?? "synthetic or standard dataset";
    const prompt = `Perform the following neural network / machine learning task using Python with NumPy and SciPy.

Task: ${task}
Architecture: ${archHint}
Dataset: ${datasetHint}

Write and execute Python code to:
1. Define the neural network architecture (layers, activations, parameters)
2. Initialize weights using appropriate schemes (Xavier, He, random)
3. Implement or use the training loop:
   - Forward pass with proper activation functions
   - Loss computation (MSE, cross-entropy, custom)
   - Backpropagation / gradient computation
   - Parameter updates (SGD, Adam, or similar)
4. Evaluate the model:
   - Training/validation loss curves
   - Accuracy, precision, recall, F1 where applicable
   - Confusion matrix for classification tasks
5. Analyze results and model behavior

Use these imports as needed:
import numpy as np
from scipy import optimize, special, signal
from numpy import random

For neural network utilities:
- Implement layers: Dense, Conv2D, RNN, LSTM, Attention (as needed)
- Activation functions: ReLU, sigmoid, tanh, softmax, GELU
- Loss functions: MSE, cross-entropy, binary cross-entropy
- Optimizers: SGD with momentum, Adam, RMSprop
- Regularization: dropout, L2, batch normalization
- Use NumPy for all tensor operations (no PyTorch/TensorFlow in code execution)

Provide both the computational results and analysis of the model's behavior.`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a neural network computation engine based on the scicomp-neural-mcp server. Use the codeExecution tool to run Python code with NumPy for every neural network task. Always execute actual code — never just describe what the code would do. Implement proper neural network architectures from scratch using NumPy, including forward/backward passes, gradient computation, and training loops. Show training metrics and model evaluation results.",
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
      task,
      architecture: archHint,
      dataset: datasetHint,
      result: text,
    });
  } catch (err) {
    console.error("Neural network computation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to run neural network computation",
      },
      { status: 500 },
    );
  }
}
