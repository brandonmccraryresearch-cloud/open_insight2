/**
 * Global persistent agent session store.
 *
 * Keeps the SSE connection and accumulated session data alive across
 * client-side navigations so the Autonomous Agents page can be left
 * and returned to without losing the live session.
 *
 * The store lives in module scope (singleton) — it is NOT tied to any
 * React component lifecycle.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentAction {
  idx: number;
  agentId: string;
  agentName: string;
  action: string;
  target: string;
  status: "success" | "failed" | "blocked";
  detail: string;
  latency?: number;
  httpStatus?: number;
  timestamp: string;
  type: "action" | "thought" | "session_start" | "session_end";
}

export interface AgentFinding {
  id: string;
  agentId: string;
  agentName: string;
  severity: "critical" | "error" | "warning" | "info";
  category: string;
  element: string;
  location: string;
  description: string;
  recommendation: string;
}

export interface SessionState {
  actions: AgentAction[];
  findings: AgentFinding[];
  log: string[];
  streaming: boolean;
  active: boolean;
  paused: boolean;
  selectedDuration: number;
  startedAt: number | null;
  pausedElapsed: number;
  error: string | null;
}

type Listener = () => void;

// ─── Singleton state ─────────────────────────────────────────────────────────

let state: SessionState = {
  actions: [],
  findings: [],
  log: [],
  streaming: false,
  active: false,
  paused: false,
  selectedDuration: 5 * 60,
  startedAt: null,
  pausedElapsed: 0,
  error: null,
};

const listeners = new Set<Listener>();
let abortController: AbortController | null = null;
let nextIdx = 0;

function notify() {
  for (const fn of listeners) fn();
}

function addLog(msg: string) {
  const ts = new Date().toLocaleTimeString();
  state = { ...state, log: [...state.log, `[${ts}] ${msg}`] };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getSessionState(): SessionState {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSelectedDuration(seconds: number) {
  state = { ...state, selectedDuration: seconds };
  notify();
}

export function getTimeRemaining(): number {
  if (!state.active || !state.startedAt) return 0;
  if (state.paused) {
    return Math.max(0, state.selectedDuration - state.pausedElapsed);
  }
  const elapsed = state.pausedElapsed + (Date.now() - state.startedAt) / 1000;
  return Math.max(0, state.selectedDuration - elapsed);
}

export function getElapsedTime(): number {
  if (!state.active || !state.startedAt) return 0;
  if (state.paused) return state.pausedElapsed;
  return state.pausedElapsed + (Date.now() - state.startedAt) / 1000;
}

export function pauseSession() {
  if (!state.active || state.paused) return;
  const elapsed = (Date.now() - (state.startedAt ?? Date.now())) / 1000;
  state = {
    ...state,
    paused: true,
    pausedElapsed: state.pausedElapsed + elapsed,
  };
  addLog("Session paused by user.");
  notify();
}

export function resumeSession() {
  if (!state.active || !state.paused) return;
  state = {
    ...state,
    paused: false,
    startedAt: Date.now(),
  };
  addLog("Session resumed by user.");
  notify();
}

export function startSession() {
  if (state.active) return; // already running
  nextIdx = 0;
  state = {
    ...state,
    actions: [],
    findings: [],
    log: [],
    streaming: true,
    active: true,
    paused: false,
    startedAt: Date.now(),
    pausedElapsed: 0,
    error: null,
  };
  addLog(
    `Autonomous Agent Session activated — ${Math.round(state.selectedDuration / 60)} min continuous session`,
  );
  addLog(
    "All agents operating as their PhD-level personas with real AI reasoning — persistent context across the entire session…",
  );
  notify();
  runStream();
}

export function stopSession() {
  abortController?.abort();
  abortController = null;
  addLog("Session stopped by user.");
  state = { ...state, streaming: false, active: false, paused: false };
  notify();
}

// ─── Internal: SSE stream consumer with auto-chaining ────────────────────────

/** Maximum duration the server can run a single stream segment (Vercel limit) */
const SERVER_SEGMENT_LIMIT_S = 300;
/** Minimum remaining time to justify starting a new segment */
const MIN_SEGMENT_REMAINING_S = 5;
/** Max chars for action detail in context summary */
const CTX_DETAIL_LIMIT = 100;
/** Max chars for thought detail in context summary */
const CTX_THOUGHT_LIMIT = 150;
/** Max chars for finding description in context summary */
const CTX_FINDING_LIMIT = 100;

/**
 * Builds a compact context summary from the current session state for transfer
 * to the next stream segment. This preserves agent memory across Vercel timeouts.
 */
function buildContextSummary(): string {
  const actions = state.actions.filter(a => a.type === "action");
  const thoughts = state.actions.filter(a => a.type === "thought");
  const findings = state.findings;

  const lines: string[] = [
    `--- CONTEXT TRANSFER FROM PREVIOUS SESSION SEGMENT ---`,
    `The following is a summary of what agents accomplished in the previous session segment(s).`,
    `Agents should continue from where they left off — do NOT repeat actions already performed.`,
    ``,
    `## Actions Performed (${actions.length} total):`,
  ];

  // Include last 20 actions to stay within prompt limits
  const recentActions = actions.slice(-20);
  for (const a of recentActions) {
    lines.push(`- ${a.agentName} → ${a.action} on ${a.target}: ${a.status} (${a.detail?.slice(0, CTX_DETAIL_LIMIT) ?? ""})`);
  }

  if (thoughts.length > 0) {
    lines.push(``, `## Recent Agent Thoughts:`);
    const recentThoughts = thoughts.slice(-10);
    for (const t of recentThoughts) {
      lines.push(`- ${t.agentName}: ${(t.detail || "").slice(0, CTX_THOUGHT_LIMIT)}`);
    }
  }

  if (findings.length > 0) {
    lines.push(``, `## Findings Reported:`);
    for (const f of findings) {
      lines.push(`- [${f.severity}] ${f.element}: ${f.description?.slice(0, CTX_FINDING_LIMIT) ?? ""}`);
    }
  }

  lines.push(``, `--- END CONTEXT TRANSFER ---`);
  return lines.join("\n");
}

async function runStream() {
  const controller = new AbortController();
  abortController = controller;
  const totalDuration = state.selectedDuration;
  const sessionStart = Date.now();
  let segmentNumber = 0;

  try {
    // Auto-chain loop: keep starting new stream segments until the full
    // user-selected duration has elapsed or the user stops the session.
    while (true) {
      if (controller.signal.aborted) break;

      const elapsedS = (Date.now() - sessionStart) / 1000;
      const remainingS = totalDuration - elapsedS;
      if (remainingS <= MIN_SEGMENT_REMAINING_S) break; // less than threshold remaining, stop

      segmentNumber++;
      // Each segment runs for at most SERVER_SEGMENT_LIMIT_S or remaining time
      const segmentDuration = Math.min(SERVER_SEGMENT_LIMIT_S, Math.ceil(remainingS));

      if (segmentNumber > 1) {
        addLog(`Auto-continuing session (segment ${segmentNumber}) — ${Math.ceil(remainingS)}s remaining of ${Math.round(totalDuration / 60)} min session.`);
        notify();
      }

      // Build URL with context summary for continuation segments
      let url = `/api/audit/stream?continuous=true&duration=${segmentDuration}`;
      if (segmentNumber > 1) {
        const ctx = buildContextSummary();
        url += `&context=${encodeURIComponent(ctx)}`;
      }

      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        let errorText = "";
        try {
          errorText = await res.text();
        } catch {
          // ignore errors while reading error body
        }
        const message =
          `Stream request failed with status ${res.status}` +
          (errorText ? `: ${errorText}` : "");
        throw new Error(message);
      }

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const event = JSON.parse(payload) as Record<string, unknown>;
            processEvent(event);
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // Check if total session time has elapsed
      const totalElapsed = (Date.now() - sessionStart) / 1000;
      if (totalElapsed >= totalDuration - MIN_SEGMENT_REMAINING_S) break; // done
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      state = {
        ...state,
        error: err instanceof Error ? err.message : "Stream error",
      };
    }
  }

  addLog(`Continuous session completed — ${segmentNumber} segment(s) over ${formatElapsed(Date.now() - sessionStart)}.`);
  state = { ...state, streaming: false, active: false, paused: false };
  notify();
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

function processEvent(event: Record<string, unknown>) {
  const type = event.type as string;
  const now = new Date().toLocaleTimeString();

  if (
    type === "action" ||
    type === "session_start" ||
    type === "session_end"
  ) {
    const a: AgentAction = {
      idx: nextIdx++,
      agentId: (event.agentId as string) ?? "system",
      agentName: (event.agentName as string) ?? "System",
      action: (event.action as string) ?? type,
      target: (event.target as string) ?? "",
      status:
        (event.status as AgentAction["status"]) ?? "success",
      detail: (event.detail as string) ?? "",
      latency: event.latency as number | undefined,
      httpStatus: event.httpStatus as number | undefined,
      timestamp: now,
      type: type as AgentAction["type"],
    };
    state = { ...state, actions: [...state.actions, a] };
    addLog(
      `${a.agentName} → ${a.action}${a.target ? ` on ${a.target}` : ""}${a.httpStatus ? ` [HTTP ${a.httpStatus}]` : ""}${a.latency ? ` (${a.latency}ms)` : ""}`,
    );
  } else if (type === "thought") {
    const t: AgentAction = {
      idx: nextIdx++,
      agentId: (event.agentId as string) ?? "system",
      agentName: (event.agentName as string) ?? "System",
      action: "thinking",
      target: "",
      status: "success",
      detail: (event.detail as string) ?? "",
      timestamp: now,
      type: "thought",
    };
    state = { ...state, actions: [...state.actions, t] };
    addLog(
      `${t.agentName} 💭 ${(t.detail || "").slice(0, 200)}`,
    );
  } else if (type === "finding") {
    const f: AgentFinding = {
      id: (event.findingId as string) ?? `f-${state.findings.length}`,
      agentId: (event.agentId as string) ?? "system",
      agentName: (event.agentName as string) ?? "System",
      severity:
        (event.severity as AgentFinding["severity"]) ?? "info",
      category: (event.category as string) ?? "error",
      element: (event.element as string) ?? "",
      location: (event.location as string) ?? "",
      description: (event.description as string) ?? "",
      recommendation: (event.recommendation as string) ?? "",
    };
    state = { ...state, findings: [...state.findings, f] };
  }

  notify();
}
