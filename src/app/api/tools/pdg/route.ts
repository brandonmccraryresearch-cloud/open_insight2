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

  let body: { query?: string; particle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { query, particle } = body;
  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "A 'query' string is required" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const particleHint = particle ? ` Focus on particle: ${particle}.` : "";
    const prompt = `Look up the following particle physics data from the Particle Data Group (PDG) database and other authoritative sources.

Query: ${query}${particleHint}

Search for and provide:
1. Particle properties (mass, charge, spin, lifetime, decay modes)
2. PDG review information if available
3. Experimental measurements with uncertainties
4. Key references and PDG citation
5. Any relevant cross-sections, branching ratios, or coupling constants

Use the PDG website (pdg.lbl.gov) and related sources as primary references.`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a particle physics data assistant with access to the Particle Data Group (PDG) database. Use the googleSearch tool to look up current particle physics data from pdg.lbl.gov and related authoritative sources. Always cite specific PDG reviews or listings. Provide numerical values with proper uncertainties and units (MeV/c², GeV, etc.).",
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
      query,
      particle: particle ?? null,
      result: text,
    });
  } catch (err) {
    console.error("PDG lookup error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to look up particle physics data",
      },
      { status: 500 },
    );
  }
}
