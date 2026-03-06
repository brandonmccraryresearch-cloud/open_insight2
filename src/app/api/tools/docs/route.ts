import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { query } = body;
  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "A 'query' string is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const prompt = `Search for the latest documentation and best practices for: ${query}\n\nProvide a structured answer with:\n1. Official documentation links\n2. Key API references or usage examples\n3. Recent changes or version notes if relevant\n4. Common patterns and best practices`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a documentation research assistant. Use the googleSearch tool to find the most up-to-date documentation, API references, and guides. Always cite sources with URLs. Focus on official documentation first, then community resources.",
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

    return NextResponse.json({ query, result: text });
  } catch (err) {
    console.error("Docs search error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to search documentation" },
      { status: 500 },
    );
  }
}
