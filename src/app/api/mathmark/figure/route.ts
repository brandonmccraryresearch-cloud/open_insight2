import { NextRequest, NextResponse } from "next/server";
import { hasGeminiKey, REQUIRED_MODEL, REQUIRED_CONFIG, enforceModelConfig } from "@/lib/gemini";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { description, format } = await req.json();

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const fmt = format || "svg";

    if (!hasGeminiKey()) {
      const stubSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1a1b2e" rx="8"/>
  <text x="200" y="140" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="system-ui">
    [Figure: ${description.slice(0, 60)}]
  </text>
  <text x="200" y="170" text-anchor="middle" fill="#64748b" font-size="11" font-family="system-ui">
    Configure GEMINI_API_KEY for AI-generated figures
  </text>
</svg>`;
      return NextResponse.json({
        code: stubSvg,
        format: "svg",
        caption: description,
        markdown: `![${description}](data:image/svg+xml;base64,${Buffer.from(stubSvg).toString("base64")})`,
      });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const formatInstructions: Record<string, string> = {
      svg: 'Generate an SVG figure. Return the complete <svg> element with viewBox, styled for a dark background (#1a1b2e). Use colors from this palette: teal=#2dd4bf, gold=#d4a017, purple=#8b5cf6, red=#ef4444, blue=#3b82f6. Include axis labels and a title if appropriate.',
      matplotlib: 'Generate a Python matplotlib code block that creates the figure. Use plt.style.use("dark_background") and save to a variable `fig`. Use colors: teal=#2dd4bf, gold=#d4a017, purple=#8b5cf6.',
      tikz: 'Generate a TikZ/PGFplots code block for LaTeX. The code should compile standalone. Use dark theme colors where possible.',
    };

    const prompt = `Generate a mathematical/scientific figure based on this description: "${description}"

${formatInstructions[fmt] || formatInstructions.svg}

Return ONLY valid JSON:
{
  "code": "the complete figure code",
  "format": "${fmt}",
  "caption": "a short descriptive caption",
  "markdown": "markdown to insert into the document (for SVG, use an inline data URI image; for code, use a fenced code block)"
}`;

    enforceModelConfig(REQUIRED_MODEL, REQUIRED_CONFIG);
    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config: {
        ...REQUIRED_CONFIG,
        systemInstruction:
          "You are an expert scientific figure generator. Create precise, publication-quality figures. Return ONLY valid JSON, no markdown fences or extra text.",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = (response.text ?? "").replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(raw);

    if (parsed.format === "svg" && parsed.code && !parsed.markdown?.includes("data:image")) {
      const b64 = Buffer.from(parsed.code).toString("base64");
      parsed.markdown = `![${parsed.caption || description}](data:image/svg+xml;base64,${b64})`;
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("MathMark figure error:", error);
    return NextResponse.json(
      { error: "Failed to generate figure" },
      { status: 500 },
    );
  }
}
