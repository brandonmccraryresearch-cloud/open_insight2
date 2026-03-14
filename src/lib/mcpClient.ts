/**
 * MCP Process Manager for Open Insight
 *
 * Implements the MCP protocol (JSON-RPC 2.0 over stdin/stdout) to communicate
 * with local MCP server subprocesses. Each server gets a lazy-initialized
 * singleton process that stays alive across requests (within the same Node.js
 * process), with automatic restart on crash (up to MAX_RESTARTS) and a 30s
 * timeout per call.
 *
 * In serverless environments (Vercel) where subprocesses can't persist, all
 * calls automatically fall back to the provided Gemini fallback function.
 *
 * Usage:
 *   const { result, executionMode } = await callMcpTool(
 *     MATH_MCP_SERVER,
 *     "symbolic_integrate",
 *     { expression: "sin(x)", variable: "x" },
 *     () => geminiMathFallback(...)  // called if MCP unavailable
 *   );
 */

import { spawn, type ChildProcess } from "child_process";
import { resolve as resolvePath } from "path";
import { access } from "fs/promises";

// ── Constants ─────────────────────────────────────────────────────────────────

const MCP_TIMEOUT_MS = 30_000;
const MAX_RESTARTS = 3;
const MCP_PROTOCOL_VERSION = "2024-11-05";

// ── Server configurations ─────────────────────────────────────────────────────

export interface McpServerConfig {
  /** Stable identifier used as the key in the process map */
  id: string;
  /** Executable to spawn (binary name or full path) */
  command: string;
  /** Arguments passed to the command */
  args: string[];
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Human-readable description */
  description?: string;
}

/**
 * Preconfigured server definitions for all MCP servers used by Open Insight.
 *
 * Binary resolution order:
 * 1. MCP_SERVERS_PATH env var (override for virtualenv/Docker)
 * 2. ~/.local/bin (pip install --user)
 * 3. System PATH
 */
export const MATH_MCP_SERVER: McpServerConfig = {
  id: "scicomp-math-mcp",
  command: "scicomp-math-mcp",
  args: [],
  description: "scicomp-math-mcp — symbolic algebra, calculus, linear algebra (14 tools)",
};

export const QUANTUM_MCP_SERVER: McpServerConfig = {
  id: "scicomp-quantum-mcp",
  command: "scicomp-quantum-mcp",
  args: [],
  description: "scicomp-quantum-mcp — Schrödinger equation, wave packets, quantum simulation (12 tools)",
};

export const MOLECULAR_MCP_SERVER: McpServerConfig = {
  id: "scicomp-molecular-mcp",
  command: "scicomp-molecular-mcp",
  args: [],
  description: "scicomp-molecular-mcp — Lennard-Jones MD, RDF, MSD, thermodynamics (15 tools)",
};

export const NEURAL_MCP_SERVER: McpServerConfig = {
  id: "scicomp-neural-mcp",
  command: "scicomp-neural-mcp",
  args: [],
  description: "scicomp-neural-mcp — neural network training, evaluation, analysis (14 tools)",
};

export const PDG_MCP_SERVER: McpServerConfig = {
  id: "particlephysics-mcp",
  command: "particlephysics-mcp",
  args: [],
  description: "particlephysics-mcp — PDG particle database, 400+ particles, offline (ParticlePhysics MCP)",
};

/** All known MCP servers for status checks */
export const ALL_MCP_SERVERS: McpServerConfig[] = [
  MATH_MCP_SERVER,
  QUANTUM_MCP_SERVER,
  MOLECULAR_MCP_SERVER,
  NEURAL_MCP_SERVER,
  PDG_MCP_SERVER,
];

// ── Internal process state ────────────────────────────────────────────────────

/** The standard MCP `tools/call` response shape (JSON-RPC result) */
export interface McpRpcResponse {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface McpProcess {
  proc: ChildProcess;
  initialized: boolean;
  initPromise: Promise<void> | null;
  pendingRequests: Map<number, PendingRequest>;
  nextId: number;
  buffer: string;
  restartCount: number;
  crashed: boolean;
}

/** Module-level singleton map — one process per server id */
const _processes = new Map<string, McpProcess>();

// ── Binary resolution ─────────────────────────────────────────────────────────

/** Extra PATH entries to search when locating MCP server binaries */
function getExtraPath(): string {
  const extra = process.env.MCP_SERVERS_PATH;
  const userLocal = `${process.env.HOME ?? "/root"}/.local/bin`;
  return extra ? `${extra}:${userLocal}` : userLocal;
}

/** Returns the resolved command path or undefined if not found */
async function resolveCommand(command: string): Promise<string | undefined> {
  // 1. Check MCP_SERVERS_PATH / ~/.local/bin first
  const extraDirs = getExtraPath().split(":");
  for (const dir of extraDirs) {
    const candidate = resolvePath(dir, command);
    try {
      await access(candidate);
      return candidate;
    } catch { /* not found here */ }
  }

  // 2. Fall back to PATH resolution — return the command name bare and let the
  //    OS/shell find it (spawn will throw if it doesn't exist)
  return command;
}

/** Quick binary availability check (no spawn) */
export async function isCommandAvailable(command: string): Promise<boolean> {
  const resolved = await resolveCommand(command);
  if (!resolved || resolved === command) {
    // Try $PATH-based which via a fast access check in common dirs
    const pathDirs = (process.env.PATH ?? "").split(":");
    const allDirs = [...getExtraPath().split(":"), ...pathDirs];
    for (const dir of allDirs) {
      try {
        await access(resolvePath(dir, command));
        return true;
      } catch { /* continue */ }
    }
    return false;
  }
  return true;
}

// ── Process lifecycle ─────────────────────────────────────────────────────────

/** Send a raw JSON-RPC request and await its response */
function sendRpc(mcpProc: McpProcess, method: string, params: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (mcpProc.crashed || !mcpProc.proc.stdin?.writable) {
      reject(new Error(`MCP process ${mcpProc.proc.pid} is not writable`));
      return;
    }

    const id = mcpProc.nextId++;
    const timer = setTimeout(() => {
      mcpProc.pendingRequests.delete(id);
      reject(new Error(`MCP timeout after ${MCP_TIMEOUT_MS}ms: ${method}`));
    }, MCP_TIMEOUT_MS);

    mcpProc.pendingRequests.set(id, { resolve, reject, timer });

    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    mcpProc.proc.stdin.write(msg, (err) => {
      if (err) {
        clearTimeout(timer);
        mcpProc.pendingRequests.delete(id);
        reject(err);
      }
    });
  });
}

/** Parse stdout lines into pending-request resolutions */
function onStdoutData(mcpProc: McpProcess, chunk: Buffer): void {
  mcpProc.buffer += chunk.toString("utf8");
  let nl: number;
  while ((nl = mcpProc.buffer.indexOf("\n")) !== -1) {
    const line = mcpProc.buffer.slice(0, nl).trim();
    mcpProc.buffer = mcpProc.buffer.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } };
      if (typeof msg.id === "number") {
        const pending = mcpProc.pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          mcpProc.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message ?? "MCP error"));
          } else {
            pending.resolve(msg.result);
          }
        }
      }
    } catch { /* ignore non-JSON lines (e.g. startup messages) */ }
  }
}

/** Spawn and initialize an MCP server process */
async function spawnAndInit(config: McpServerConfig): Promise<McpProcess> {
  const command = (await resolveCommand(config.command)) ?? config.command;

  const proc = spawn(command, config.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      // Ensure ~/.local/bin is in PATH for transitive subprocess calls
      PATH: `${getExtraPath()}:${process.env.PATH ?? ""}`,
      ...config.env,
    },
  });

  const mcpProc: McpProcess = {
    proc,
    initialized: false,
    initPromise: null,
    pendingRequests: new Map(),
    nextId: 1,
    buffer: "",
    restartCount: (_processes.get(config.id)?.restartCount ?? 0),
    crashed: false,
  };

  proc.stdout?.on("data", (chunk: Buffer) => onStdoutData(mcpProc, chunk));
  proc.stderr?.on("data", () => { /* suppress stderr noise from MCP servers */ });

  proc.on("exit", (code) => {
    mcpProc.crashed = true;
    _processes.delete(config.id);
    const reason = new Error(`MCP process exited (code ${code})`);
    for (const [, pending] of mcpProc.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    mcpProc.pendingRequests.clear();
  });

  proc.on("error", (err) => {
    mcpProc.crashed = true;
    _processes.delete(config.id);
    const reason = new Error(`MCP spawn error: ${err.message}`);
    for (const [, pending] of mcpProc.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    mcpProc.pendingRequests.clear();
  });

  _processes.set(config.id, mcpProc);

  // MCP handshake: send initialize and wait for response
  mcpProc.initPromise = sendRpc(mcpProc, "initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "open-insight", version: "1.0" },
  }).then(() => {
    mcpProc.initialized = true;
    mcpProc.initPromise = null;
  }).catch((err: unknown) => {
    mcpProc.crashed = true;
    _processes.delete(config.id);
    throw err;
  });

  await mcpProc.initPromise;

  // Register teardown handler once for the whole process
  registerExitHandler();

  return mcpProc;
}

/** Get running process or spawn a new one */
async function getOrSpawn(config: McpServerConfig): Promise<McpProcess> {
  const existing = _processes.get(config.id);
  if (existing && !existing.crashed) {
    if (existing.initPromise) await existing.initPromise;
    return existing;
  }
  return spawnAndInit(config);
}

// ── Exit handler ──────────────────────────────────────────────────────────────

let _exitHandlerRegistered = false;

function registerExitHandler(): void {
  if (_exitHandlerRegistered) return;
  _exitHandlerRegistered = true;

  const teardown = () => {
    for (const [, mcpProc] of _processes) {
      try { mcpProc.proc.kill(); } catch { /* ignore */ }
    }
    _processes.clear();
  };

  process.once("exit", teardown);
  process.once("SIGTERM", teardown);
  process.once("SIGINT", teardown);
}

// ── Public API ────────────────────────────────────────────────────────────────

export type McpExecutionMode = "mcp" | "gemini";

export interface McpToolResult {
  result: unknown;
  executionMode: McpExecutionMode;
  mcpServer?: string;
}

/**
 * Call a tool on a real MCP server, with automatic Gemini fallback.
 *
 * If the binary is not found, the process crashes, or the call times out,
 * `fallback()` is invoked and `executionMode` is set to `"gemini"`. If no
 * fallback is provided, the error is re-thrown.
 *
 * @param config   - Server definition (command, args, etc.)
 * @param toolName - MCP tool name (e.g. "symbolic_integrate")
 * @param params   - Tool arguments object
 * @param fallback - Optional Gemini fallback; called when MCP is unavailable
 */
export async function callMcpTool(
  config: McpServerConfig,
  toolName: string,
  params: Record<string, unknown>,
  fallback?: () => Promise<unknown>,
): Promise<McpToolResult> {
  // Skip immediately if this server has crashed too many times
  const existing = _processes.get(config.id);
  if (existing && existing.restartCount >= MAX_RESTARTS) {
    if (fallback) {
      return { result: await fallback(), executionMode: "gemini" };
    }
    throw new Error(`MCP server ${config.id} exceeded max restarts`);
  }

  try {
    const mcpProc = await getOrSpawn(config);
    const raw = await sendRpc(mcpProc, "tools/call", {
      name: toolName,
      arguments: params,
    }) as McpRpcResponse | undefined;
    // Flatten MCP content array into a string
    const text = Array.isArray(raw?.content)
      ? raw!.content.map((c) => c.text ?? "").join("\n").trim()
      : String(raw ?? "");

    if (raw?.isError) throw new Error(`MCP tool error: ${text}`);

    return { result: text, executionMode: "mcp", mcpServer: config.id };
  } catch {
    // Increment restart counter so we back off after repeated failures
    const proc = _processes.get(config.id);
    if (proc) proc.restartCount++;

    if (fallback) {
      return { result: await fallback(), executionMode: "gemini" };
    }
    throw new Error(`MCP server ${config.id} unavailable`);
  }
}

/**
 * List all tools exposed by a server (used by the status endpoint).
 * Returns an empty array if the server is unavailable.
 */
export async function listMcpTools(config: McpServerConfig): Promise<string[]> {
  try {
    const mcpProc = await getOrSpawn(config);
    const raw = await sendRpc(mcpProc, "tools/list", {}) as
      { tools?: Array<{ name: string }> } | undefined;
    return (raw?.tools ?? []).map((t) => t.name);
  } catch {
    return [];
  }
}

/**
 * Check availability of an MCP server (binary exists + can initialize).
 * Caches the positive result in the running process for subsequent calls.
 */
export async function isMcpServerAvailable(config: McpServerConfig): Promise<boolean> {
  // Quick binary check first (no spawn)
  const binOk = await isCommandAvailable(config.command);
  if (!binOk) return false;

  try {
    const proc = await getOrSpawn(config);
    return proc.initialized && !proc.crashed;
  } catch {
    return false;
  }
}
