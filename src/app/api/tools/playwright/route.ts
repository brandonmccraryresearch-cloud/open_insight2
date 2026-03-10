import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";

export const maxDuration = 120;

/** Only allow interaction with pages on the same deployment or safe external sites */
function isAllowedTarget(url: string, appOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    const origin = new URL(appOrigin);

    // Allow same-origin pages (the app itself)
    if (parsed.origin === origin.origin) return true;

    // Allow specific safe external domains for research
    const safeDomains = [
      "arxiv.org",
      "pdg.lbl.gov",
      "mathscinet.ams.org",
      "inspirehep.net",
      "scholar.google.com",
      "en.wikipedia.org",
      "ncatlab.org",
      "mathoverflow.net",
      "physics.stackexchange.com",
    ];
    return safeDomains.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

type PlaywrightCommand =
  | "navigate"
  | "read_page"
  | "find_elements"
  | "click"
  | "fill"
  | "screenshot";

export async function POST(request: NextRequest) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: {
    command?: PlaywrightCommand;
    url?: string;
    selector?: string;
    value?: string;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { command, url, selector, value, description } = body;

  if (!command || typeof command !== "string") {
    return NextResponse.json(
      { error: "A 'command' string is required (navigate, read_page, find_elements, click, fill, screenshot)" },
      { status: 400 },
    );
  }

  const validCommands: PlaywrightCommand[] = [
    "navigate",
    "read_page",
    "find_elements",
    "click",
    "fill",
    "screenshot",
  ];
  if (!validCommands.includes(command as PlaywrightCommand)) {
    return NextResponse.json(
      { error: `Invalid command '${command}'. Must be one of: ${validCommands.join(", ")}` },
      { status: 400 },
    );
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "A 'url' string is required" },
      { status: 400 },
    );
  }

  // Determine app origin from request
  const appOrigin =
    request.headers.get("x-forwarded-host")
      ? `https://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;

  if (!isAllowedTarget(url, appOrigin)) {
    return NextResponse.json(
      { error: "URL is not in the allowed target list. Only the app itself and select research sites are permitted." },
      { status: 403 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    let prompt: string;
    switch (command) {
      case "navigate":
        prompt = `Navigate to the following URL and describe what you see on the page. Provide a structured overview of the page layout, main content areas, navigation elements, and any interactive components.\n\nURL: ${url}`;
        break;
      case "read_page":
        prompt = `Read the content of the following URL and extract all meaningful text content, organized by sections. ${description ? `Focus on: ${description}` : "Include headings, paragraphs, lists, and any data tables."}\n\nURL: ${url}`;
        break;
      case "find_elements":
        prompt = `Analyze the page at the following URL and identify all interactive elements${selector ? ` matching the description: "${selector}"` : ""}. List buttons, links, forms, inputs, and other interactive components with their labels and purposes.\n\nURL: ${url}`;
        break;
      case "click":
        prompt = `Analyze the page at the following URL and describe what would happen if a user clicked on the element: "${selector ?? "the main action button"}". Describe the element, its purpose, and the expected result of the interaction.\n\nURL: ${url}`;
        break;
      case "fill":
        prompt = `Analyze the page at the following URL and describe the form field "${selector ?? "the main input"}". What type of input is it? What value would be appropriate? The intended value is: "${value ?? ""}"\n\nURL: ${url}`;
        break;
      case "screenshot":
        prompt = `Provide a detailed visual description of the page at the following URL, as if describing a screenshot. Include layout, colors, typography, images, and overall visual design.\n\nURL: ${url}`;
        break;
    }

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a browser automation assistant powered by Gemini's urlContext capability. When given a URL, use the urlContext tool to read and analyze the page. Provide structured, actionable information about the page's content, layout, and interactive elements. Be precise about element identification and page structure.",
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
      command,
      url,
      selector: selector ?? null,
      value: value ?? null,
      result: text,
    });
  } catch (err) {
    console.error("Playwright tool error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to execute browser command",
      },
      { status: 500 },
    );
  }
}
