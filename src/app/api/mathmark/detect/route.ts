import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        score: 50,
        verdict: "Analysis unavailable — no API key configured.",
        segments: [
          {
            text: content.slice(0, 200),
            score: 50,
            explanation: "Unable to perform AI detection without an API key.",
            suggestion: "Configure GEMINI_API_KEY to enable detection.",
          },
        ],
      });
    }

    const genai = new GoogleGenAI({ apiKey });

    const prompt = `Analyze the following text for AI-generated content indicators. Score from 0 (definitely AI) to 100 (definitely human). Return ONLY valid JSON:

{
  "score": number,
  "verdict": "string summary",
  "segments": [
    {
      "text": "excerpt from the document",
      "score": number,
      "explanation": "why this segment scored this way",
      "suggestion": "how to make it more authentic"
    }
  ]
}

Text:
${content}`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction:
          "You are an AI content detection assistant. Return ONLY valid JSON, no markdown fences or extra text.",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = (response.text ?? "").replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("MathMark detect error:", error);
    return NextResponse.json(
      { error: "Failed to run detection" },
      { status: 500 },
    );
  }
}
