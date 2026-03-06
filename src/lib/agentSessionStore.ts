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

// ─── Internal: SSE stream consumer ───────────────────────────────────────────

async function runStream() {
  const controller = new AbortController();
  abortController = controller;

  try {
    const url = `/api/audit/stream?continuous=true&duration=${state.selectedDuration}`;
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
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      state = {
        ...state,
        error: err instanceof Error ? err.message : "Stream error",
      };
    }
  }

  addLog("Session stream ended.");
  state = { ...state, streaming: false, active: false, paused: false };
  notify();
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
