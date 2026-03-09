import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";
import dns from "node:dns/promises";
import net from "node:net";

export const maxDuration = 120;

function isPrivateOrLocalIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
      ip,
    );
  }
  if (family === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized.startsWith("::ffff:172.")
    );
  }
  return false;
}

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

  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    isPrivateOrLocalIp(hostname)
  ) {
    return NextResponse.json(
      { error: "URL may not target localhost or private network addresses" },
      { status: 400 },
    );
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.some((r) => isPrivateOrLocalIp(r.address))) {
      return NextResponse.json(
        { error: "URL resolves to a localhost or private network address" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not resolve target hostname" },
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
