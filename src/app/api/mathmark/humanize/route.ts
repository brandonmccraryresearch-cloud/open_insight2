import { NextRequest, NextResponse } from "next/server";
import { hasGeminiKey, REQUIRED_MODEL, REQUIRED_CONFIG, enforceModelConfig } from "@/lib/gemini";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { content, segments } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (!hasGeminiKey()) {
      const rewritten = content
        .replace(/\bUtilize\b/g, "Use")
        .replace(/\bIn order to\b/gi, "To")
        .replace(/\bIt is worth noting that\b/gi, "Note that")
        .replace(/\bFurthermore\b/gi, "Also")
        .replace(/\bAdditionally\b/gi, "Also")
        .replace(/\bConsequently\b/gi, "So");
      return NextResponse.json({
        rewritten,
        changes: [
          { original: "Utilize", replacement: "Use", reason: "Simpler word choice (stub — configure GEMINI_API_KEY for full rewriting)" },
        ],
      });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const segmentInfo = segments?.length
      ? `\n\nThe following passages were flagged as AI-generated:\n${(segments as Array<{ text: string; score: number }>).map((s, i) => `${i + 1}. (score ${s.score}/100) "${s.text}"`).join("\n")}`
      : "";

    const prompt = `Rewrite the following document to sound more natural and human-written. Preserve ALL technical content, LaTeX math ($...$, $$...$$), code blocks, tables, and markdown formatting exactly. Only rephrase prose passages to sound more authentic, varied, and less formulaic.${segmentInfo}

Return ONLY valid JSON:
{
  "rewritten": "the full rewritten document",
  "changes": [
    { "original": "exact original phrase", "replacement": "rewritten phrase", "reason": "why this change makes it sound more human" }
  ]
}

Document:
${content}`;

    enforceModelConfig(REQUIRED_MODEL, REQUIRED_CONFIG);
    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config: {
        ...REQUIRED_CONFIG,
        systemInstruction:
          "You are a ghostwriter assistant. Rewrite text to sound more natural and human while preserving all technical content and formatting. Return ONLY valid JSON, no markdown fences or extra text.",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = (response.text ?? "").replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("MathMark humanize error:", error);
    return NextResponse.json(
      { error: "Failed to humanize document" },
      { status: 500 },
    );
  }
}
