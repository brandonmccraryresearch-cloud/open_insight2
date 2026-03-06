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

  let body: { url?: string; query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { url, query } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "A 'url' string is required" },
      { status: 400 },
    );
  }

  // URL validation and SSRF protection
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid 'url' format" },
      { status: 400 },
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "URL must use http or https scheme" },
      { status: 400 },
    );
  }

  const hostname = parsedUrl.hostname;
  const privateIpPattern =
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80") ||
    privateIpPattern.test(hostname)
  ) {
    return NextResponse.json(
      { error: "URL may not target localhost or private network addresses" },
      { status: 400 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const prompt = query
      ? `Browse the following URL and summarize its content, focusing on: ${query}\n\nURL: ${url}`
      : `Browse the following URL and provide a comprehensive summary of its content.\n\nURL: ${url}`;

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a web research assistant. When given a URL, use the urlContext tool to read the page and provide a clear, structured summary. Include key facts, data points, and relevant details. Be thorough but concise.",
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

    return NextResponse.json({ url, query: query ?? null, summary: text });
  } catch (err) {
    console.error("Browse error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to browse URL" },
      { status: 500 },
    );
  }
}
