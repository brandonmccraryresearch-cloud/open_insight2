import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  hasGeminiKey,
  REQUIRED_MODEL,
  REQUIRED_CONFIG,
  enforceModelConfig,
} from "@/lib/gemini";
import {
  isAllowedTarget,
  isAvailable as isBrowserAvailable,
  navigateAndSnapshot,
  findInteractiveElements,
  clickElement,
  fillField,
  captureScreenshot,
} from "@/lib/playwrightBrowser";

export const maxDuration = 120;

type PlaywrightCommand =
  | "navigate"
  | "snapshot"
  | "read_page"
  | "find_elements"
  | "click"
  | "fill"
  | "screenshot";

const VALID_COMMANDS: PlaywrightCommand[] = [
  "navigate",
  "snapshot",
  "read_page",
  "find_elements",
  "click",
  "fill",
  "screenshot",
];

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { command, url, selector, value, description } = body;

  if (!command || !VALID_COMMANDS.includes(command as PlaywrightCommand)) {
    return NextResponse.json(
      {
        error: `A valid 'command' is required: ${VALID_COMMANDS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "A 'url' string is required" },
      { status: 400 },
    );
  }

  // Determine app origin from trusted server-side config (NOT from user headers)
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : request.nextUrl.origin);

  if (!isAllowedTarget(url, appOrigin)) {
    return NextResponse.json(
      {
        error:
          "URL is not in the allowed target list. Only the app itself and approved research sites are permitted.",
      },
      { status: 403 },
    );
  }

  // ── Real Playwright browser path ──────────────────────────────────────────
  const browserAvailable = await isBrowserAvailable();

  if (browserAvailable) {
    try {
      switch (command) {
        // `navigate`, `snapshot`, and `read_page` all return the same structured
        // payload (accessibility tree + organized text). They differ only in the
        // label agents use: `snapshot` = "give me the whole tree"; `navigate` =
        // "go here first"; `read_page` = "extract readable text". The underlying
        // navigateAndSnapshot() call is identical for all three.
        case "navigate":
        case "snapshot":
        case "read_page": {
          const snap = await navigateAndSnapshot(url);
          return NextResponse.json({
            executionMode: "playwright",
            command,
            url: snap.url,
            title: snap.title,
            accessibility: snap.accessibility,
            textContent: snap.textContent,
          });
        }

        case "find_elements": {
          const elements = await findInteractiveElements(url, selector);
          return NextResponse.json({
            executionMode: "playwright",
            command,
            url,
            elements,
            count: elements.length,
          });
        }

        case "click": {
          if (!selector) {
            return NextResponse.json(
              { error: "selector is required for click command" },
              { status: 400 },
            );
          }
          const result = await clickElement(url, selector);
          return NextResponse.json({
            executionMode: "playwright",
            command,
            ...result,
          });
        }

        case "fill": {
          if (!selector) {
            return NextResponse.json(
              { error: "selector is required for fill command" },
              { status: 400 },
            );
          }
          const result = await fillField(url, selector, value ?? "");
          return NextResponse.json({
            executionMode: "playwright",
            command,
            ...result,
          });
        }

        case "screenshot": {
          const result = await captureScreenshot(url);
          return NextResponse.json({
            executionMode: "playwright",
            command,
            url: result.url,
            title: result.title,
            imageBase64: result.imageBase64,
            width: result.width,
            height: result.height,
          });
        }
      }
    } catch (err) {
      console.error("Playwright real-browser error:", err);
      // Fall through to Gemini fallback
    }
  }

  // ── Gemini URL-context fallback ───────────────────────────────────────────
  if (!hasGeminiKey()) {
    return NextResponse.json(
      {
        error:
          "Playwright browser is not available and GEMINI_API_KEY is not configured. Install Chromium with: npx playwright install chromium",
      },
      { status: 503 },
    );
  }

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    let prompt: string;
    switch (command) {
      case "navigate":
      case "snapshot":
        prompt = `Navigate to the following URL and describe the page structure in detail. Provide a structured overview of: the page title, main content areas, navigation elements, headings hierarchy, and all interactive components (buttons, links, forms).\n\nURL: ${url}`;
        break;
      case "read_page":
        prompt = `Read the content of the following URL and extract all meaningful text content, organized by sections. ${description ? `Focus on: ${description}` : "Include headings, paragraphs, lists, and any data tables."}\n\nURL: ${url}`;
        break;
      case "find_elements":
        prompt = `Analyze the page at the following URL and identify all interactive elements${selector ? ` matching the description: "${selector}"` : ""}. List buttons, links, forms, inputs, and other interactive components with their labels, roles, and purposes.\n\nURL: ${url}`;
        break;
      case "click":
        prompt = `Analyze the page at the following URL and describe what would happen if a user clicked on the element: "${selector ?? "the main action button"}". Describe the element, its current state, and the expected result of clicking it.\n\nURL: ${url}`;
        break;
      case "fill":
        prompt = `Analyze the page at the following URL and describe the form field "${selector ?? "the main input"}". What type of input is it, what is its current value, and what would be appropriate to enter? The intended value is: "${value ?? ""}"\n\nURL: ${url}`;
        break;
      case "screenshot":
        prompt = `Provide a detailed visual description of the page at the following URL. Describe the layout, visual hierarchy, color scheme, typography, images, and overall design as if you were describing a screenshot.\n\nURL: ${url}`;
        break;
      default:
        prompt = `Read and analyze the page at: ${url}`;
    }

    const config = {
      ...REQUIRED_CONFIG,
      systemInstruction:
        "You are a browser automation assistant. When given a URL, use the urlContext tool to read and analyze the page. Provide structured, actionable information about the page content, layout, and interactive elements.",
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
      executionMode: "gemini-urlcontext",
      command,
      url,
      selector: selector ?? null,
      value: value ?? null,
      result: text,
    });
  } catch (err) {
    console.error("Playwright Gemini fallback error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to execute browser command",
      },
      { status: 500 },
    );
  }
}

