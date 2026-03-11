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
 * ParticlePhysics MCP proxy — uses Gemini googleSearch to look up particle physics
 * data from the Particle Data Group (PDG).
 * Based on: ParticlePhysics MCP Server (uzerone/ParticlePhysics-MCP-Server.git)
 * Supports natural language particle names (400+ internal translations).
 */
export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const particle = typeof body.particle === "string" ? body.particle.slice(0, 200) : "";
    const property = typeof body.property === "string" ? body.property.slice(0, 200) : "";
    const query = typeof body.query === "string" ? body.query.slice(0, 500) : "";

    const searchQuery = query || `${particle} ${property} particle physics PDG data`.trim();
    if (!searchQuery.trim()) {
      return NextResponse.json({ error: "particle, property, or query is required" }, { status: 400 });
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `You are a particle physics data assistant. Using the Particle Data Group (PDG) database as your authoritative source, answer the following query about particle physics.

Query: ${searchQuery}

Provide:
1. The particle name(s), PDG ID if known
2. Requested properties (mass, lifetime, width, decay modes, quantum numbers, branching ratios) with values and uncertainties from PDG
3. The PDG edition/year for the data
4. Any relevant notes or caveats

Format your response as structured data with clear sections.`;

    const config = {
      ...REQUIRED_CONFIG,
      tools: [{ googleSearch: {} }],
      systemInstruction: "You are a particle physics data specialist with access to PDG data via Google Search. Always cite PDG sources.",
    };
    enforceModelConfig(REQUIRED_MODEL, config);

    const response = await genai.models.generateContent({
      model: REQUIRED_MODEL,
      config,
      contents: prompt,
    });

    const text = typeof response.text === "string" ? response.text : "";

    return NextResponse.json({
      tool: "particlephysics-mcp",
      query: searchQuery,
      result: text.slice(0, 5000),
      sources: "Particle Data Group (PDG) via Google Search",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
