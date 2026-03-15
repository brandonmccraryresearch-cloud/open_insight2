import { NextResponse } from "next/server";
import {
  ALL_MCP_SERVERS,
  isCommandAvailable,
  isMcpServerAvailable,
} from "@/lib/mcpClient";
import { hasGeminiKey } from "@/lib/gemini";
import { checkLeanAvailable } from "@/lib/lean4";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/tools/status
 *
 * Returns the live availability of every tool route on the platform.
 * Used by the agent prompt, the Tools UI, and operators monitoring deployments.
 *
 * Response shape:
 * {
 *   timestamp: string (ISO),
 *   gemini: boolean,
 *   lean4: { available: boolean, executionMode: "native" | "gemini" | "unavailable" },
 *   playwright: { available: boolean, executionMode: "playwright" | "gemini-urlcontext" },
 *   mcp: {
 *     [serverId]: {
 *       available: boolean,
 *       binaryFound: boolean,
 *       executionMode: "mcp" | "gemini",
 *       description: string
 *     }
 *   },
 *   routes: { [routeName]: { available: boolean, executionMode: string, requires: string[] } }
 * }
 */
export async function GET() {
  try {
    // Run all availability checks in parallel
    const [
      lean4Available,
      playwrightAvailable,
      mcpBinaryChecks,
      mcpAvailabilityChecks,
    ] = await Promise.all([
      checkLeanAvailable(),
      checkPlaywrightAvailable(),
      Promise.all(ALL_MCP_SERVERS.map((s) => isCommandAvailable(s.command).then((ok) => ({ id: s.id, ok })))),
      Promise.all(ALL_MCP_SERVERS.map((s) => isMcpServerAvailable(s).then((ok) => ({ id: s.id, ok })))),
    ]);

    const gemini = hasGeminiKey();

    // Build binary map
    const binaryMap = new Map(mcpBinaryChecks.map(({ id, ok }) => [id, ok]));
    const mcpMap = new Map(mcpAvailabilityChecks.map(({ id, ok }) => [id, ok]));

    // Build per-server status
    const mcp: Record<string, {
      available: boolean;
      binaryFound: boolean;
      executionMode: "mcp" | "gemini";
      description: string;
    }> = {};
    for (const server of ALL_MCP_SERVERS) {
      const binaryFound = binaryMap.get(server.id) ?? false;
      const available = mcpMap.get(server.id) ?? false;
      mcp[server.id] = {
        available,
        binaryFound,
        executionMode: available ? "mcp" : "gemini",
        description: server.description ?? server.id,
      };
    }

    // Build per-route status
    const routes: Record<string, {
      available: boolean;
      executionMode: string;
      requires: string[];
    }> = {
      arxiv: {
        available: true,
        executionMode: "direct-api",
        requires: [],
      },
      browse: {
        available: gemini,
        executionMode: "gemini-urlcontext",
        requires: ["GEMINI_API_KEY"],
      },
      docs: {
        available: gemini,
        executionMode: "gemini-googlesearch",
        requires: ["GEMINI_API_KEY"],
      },
      lean4: {
        available: lean4Available || gemini,
        executionMode: lean4Available ? "native" : gemini ? "gemini" : "unavailable",
        requires: lean4Available ? [] : ["GEMINI_API_KEY"],
      },
      playwright: {
        available: playwrightAvailable || gemini,
        executionMode: playwrightAvailable ? "playwright" : gemini ? "gemini-urlcontext" : "unavailable",
        requires: playwrightAvailable ? [] : gemini ? ["GEMINI_API_KEY"] : [],
      },
      notebook: {
        available: true,
        executionMode: gemini ? "gemini" : "subprocess",
        requires: gemini ? ["GEMINI_API_KEY"] : [],
      },
      math: {
        available: (mcp["scicomp-math-mcp"]?.available) || gemini,
        executionMode: mcp["scicomp-math-mcp"]?.executionMode ?? (gemini ? "gemini" : "unavailable"),
        requires: mcp["scicomp-math-mcp"]?.available ? [] : ["GEMINI_API_KEY"],
      },
      quantum: {
        available: (mcp["scicomp-quantum-mcp"]?.available) || gemini,
        executionMode: mcp["scicomp-quantum-mcp"]?.executionMode ?? (gemini ? "gemini" : "unavailable"),
        requires: mcp["scicomp-quantum-mcp"]?.available ? [] : ["GEMINI_API_KEY"],
      },
      molecular: {
        available: (mcp["scicomp-molecular-mcp"]?.available) || gemini,
        executionMode: mcp["scicomp-molecular-mcp"]?.executionMode ?? (gemini ? "gemini" : "unavailable"),
        requires: mcp["scicomp-molecular-mcp"]?.available ? [] : ["GEMINI_API_KEY"],
      },
      neural: {
        available: (mcp["scicomp-neural-mcp"]?.available) || gemini,
        executionMode: mcp["scicomp-neural-mcp"]?.executionMode ?? (gemini ? "gemini" : "unavailable"),
        requires: mcp["scicomp-neural-mcp"]?.available ? [] : ["GEMINI_API_KEY"],
      },
      pdg: {
        available: (mcp["particlephysics-mcp"]?.available) || gemini,
        executionMode: mcp["particlephysics-mcp"]?.executionMode ?? (gemini ? "gemini" : "unavailable"),
        requires: mcp["particlephysics-mcp"]?.available ? [] : ["GEMINI_API_KEY"],
      },
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      gemini,
      lean4: {
        available: lean4Available || gemini,
        executionMode: lean4Available ? "native" : gemini ? "gemini" : "unavailable",
      },
      playwright: {
        available: playwrightAvailable || gemini,
        executionMode: playwrightAvailable ? "playwright" : gemini ? "gemini-urlcontext" : "unavailable",
      },
      mcp,
      routes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 },
    );
  }
}

/** Quick check: can we import playwright and find the chromium binary? */
async function checkPlaywrightAvailable(): Promise<boolean> {
  try {
    // Use the Playwright library directly to avoid spinning up the long-lived
    // browser singleton used by the main Playwright tool route.
    const playwright = await import("playwright");

    // `executablePath()` is a lightweight probe that does not launch a browser.
    const executablePath =
      "chromium" in playwright && typeof playwright.chromium?.executablePath === "function"
        ? playwright.chromium.executablePath()
        : null;

    return typeof executablePath === "string" && executablePath.length > 0;
  } catch {
    return false;
  }
}
