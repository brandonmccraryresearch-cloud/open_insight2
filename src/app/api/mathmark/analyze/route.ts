import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { content, instruction, mode } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        sections: [
          {
            id: "stub-1",
            title: "Structure",
            summary: "AI analysis unavailable (no API key). Consider reviewing heading hierarchy and paragraph flow.",
            changes: [],
          },
          {
            id: "stub-2",
            title: "Clarity",
            summary: "Check for passive voice and overly complex sentences.",
            changes: [],
          },
        ],
      });
    }

    const genai = new GoogleGenAI({ apiKey });

    const modeLabel = mode || "general";
    const extra = instruction ? `\nAdditional instruction: ${instruction}` : "";

    const prompt = `Analyze this markdown document for improvements (mode: ${modeLabel}).${extra}

Return ONLY valid JSON matching this schema:
{
  "sections": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "changes": [
        {
          "description": "string",
          "originalText": "exact text from the document",
          "replacementText": "improved text"
        }
      ]
    }
  ]
}

Document:
${content}`;

    const response = await genai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      config: {
        topP: 1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
        systemInstruction:
          "You are a document analysis assistant. Return ONLY valid JSON, no markdown fences or extra text.",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = (response.text ?? "").replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("MathMark analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze document" },
      { status: 500 },
    );
  }
}
