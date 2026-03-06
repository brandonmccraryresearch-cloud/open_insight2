import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { REQUIRED_MODEL, REQUIRED_CONFIG, enforceModelConfig } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { message, documentContext, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        text: "AI assistant is unavailable (no API key configured). Here are some general tips:\n\n- Use `$$...$$` for display math and `$...$` for inline math\n- Structure your document with headings (`#`, `##`, `###`)\n- Use tables with `| col1 | col2 |` syntax\n- Add code blocks with triple backticks and a language identifier",
      });
    }

    const genai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a helpful writing assistant for MathMark2PDF, a markdown editor with LaTeX math support. Help the user with their document. Be concise and practical. When suggesting edits, use markdown formatting. The user's current document context is provided below.\n\nDocument:\n${documentContext || "(empty document)"}`;

    const contents = [
      ...(history || []).map((h: { role: string; text: string }) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction: systemPrompt,
    };
    enforceModelConfig(REQUIRED_MODEL, config);
    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents,
    });

    const text = response.text ?? "I couldn't generate a response. Please try again.";
    return NextResponse.json({ text });
  } catch (error) {
    console.error("MathMark chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
