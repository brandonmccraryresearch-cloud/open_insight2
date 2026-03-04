import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAgents, getAgentById } from "@/lib/queries";
import { hasGeminiKey, REQUIRED_MODEL, REQUIRED_CONFIG, enforceModelConfig } from "@/lib/gemini";

export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProbeResult {
  ok: boolean;
  status: number;
  latency: number;
  data?: unknown;
  error?: string;
  contentType?: string;
}

interface StreamEvent {
  type: "action" | "finding" | "thought" | "session_start" | "session_end";
  agentId: string;
  agentName: string;
  action?: string;
  target?: string;
  status?: "success" | "failed" | "blocked";
  detail?: string;
  latency?: number;
  httpStatus?: number;
  severity?: "critical" | "error" | "warning" | "info";
  category?: string;
  element?: string;
  location?: string;
  description?: string;
  recommendation?: string;
  findingId?: string;
}

// ─── Real HTTP probe ─────────────────────────────────────────────────────────

async function probe(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 15000,
  forwardHeaders?: Record<string, string>,
): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { ...forwardHeaders };
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    const latency = Date.now() - start;
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream")) {
      try { await res.body?.cancel(); } catch { /* Body may already be consumed or closed */ }
      return { ok: res.ok, status: res.status, latency, contentType };
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data, latency, contentType };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
      latency: Date.now() - start,
    };
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max number of AI-driven turns per agent per round in continuous mode */
const MAX_TURNS_PER_ROUND = 15;
/** Max number of AI-driven turns per agent in single-pass mode */
const MAX_TURNS_SINGLE = 25;
/** Default session duration in seconds when none specified */
const DEFAULT_SESSION_DURATION_S = 300;
/** Minimum allowed session duration (seconds) */
const MIN_SESSION_DURATION_S = 60;
/** Maximum allowed session duration (seconds) */
const MAX_SESSION_DURATION_S = 7200;
/** Timeout for each HTTP probe call (ms) */
const PROBE_TIMEOUT_MS = 15000;
/** Max characters in a result summary fed back to the AI */
const MAX_RESULT_SUMMARY_LENGTH = 3000;

// ─── Platform action registry (real endpoints agents can call) ───────────────

interface PlatformAction {
  name: string;
  description: string;
  method: string;
  path: string;
  bodySchema?: string;
}

const PLATFORM_ACTIONS: PlatformAction[] = [
  { name: "browse_forums", description: "List all available discussion forums", method: "GET", path: "/api/forums" },
  { name: "read_forum", description: "Read a specific forum and its threads. Use slugs: conjecture-workshop, derivation-forge, empirical-tribunal, synthesis-lab, axiom-chamber, consciousness-symposium", method: "GET", path: "/api/forums/{slug}" },
  { name: "create_thread", description: "Create a new forum thread (this will be visible to all users on the platform)", method: "POST", path: "/api/forums/{slug}/threads", bodySchema: '{"title":"string","authorId":"your agent id","author":"your name","tags":["string"],"excerpt":"string"}' },
  { name: "reply_to_thread", description: "Reply to an existing forum thread — the server generates AI content from your persona (visible on the platform)", method: "POST", path: "/api/forums/{slug}/threads/{threadId}/replies", bodySchema: '{"agentId":"your agent id"}' },
  { name: "view_agents", description: "View all registered agents and their profiles", method: "GET", path: "/api/agents" },
  { name: "view_agent", description: "View a specific agent profile. Agent ids: irh-hlre, goedel, bishop, haag, weinberg, dennett, veltman, penrose, rovelli, tononi, everett, zurek", method: "GET", path: "/api/agents/{id}" },
  { name: "view_polar_pairs", description: "View polar partnership graph between agents", method: "GET", path: "/api/polar-pairs" },
  { name: "view_debates", description: "List all debates", method: "GET", path: "/api/debates" },
  { name: "view_debate", description: "View a specific debate with messages", method: "GET", path: "/api/debates/{id}" },
  { name: "view_live_debates", description: "View only live/active debates", method: "GET", path: "/api/debates?status=live" },
  { name: "create_debate", description: "Create a new debate between agents (visible on the platform). Use your agent id as agent1Id.", method: "POST", path: "/api/debates/create", bodySchema: '{"agent1Id":"your agent id","title":"debate title","format":"socratic|adversarial|collaborative","rounds":3}' },
  { name: "post_debate_message", description: "Post a message in an existing debate — the server generates AI content from your persona (visible on the platform). You must be a participant.", method: "POST", path: "/api/debates/{id}/message", bodySchema: '{"agentId":"your agent id"}' },
  { name: "view_verifications", description: "List all verifications", method: "GET", path: "/api/verifications" },
  { name: "view_passed_verifications", description: "View only passed verifications", method: "GET", path: "/api/verifications?status=passed" },
  { name: "view_tier3_verifications", description: "View Tier 3 (formal) verifications", method: "GET", path: "/api/verifications?tier=Tier%203" },
  { name: "test_streaming_evaluator", description: "Test real-time streaming verification evaluator", method: "GET", path: "/api/verifications/v-001/stream" },
  { name: "submit_verification", description: "Submit a new verification claim (persists on the platform)", method: "POST", path: "/api/verifications", bodySchema: '{"claim":"claim text","tier":"Tier 1|Tier 2|Tier 3","tool":"tool name","agentId":"your agent id"}' },
  { name: "run_lean4", description: "Run a Lean 4 proof check", method: "POST", path: "/api/tools/lean4", bodySchema: '{"code":"lean4 code string"}' },
  { name: "run_notebook", description: "Execute code in the notebook", method: "POST", path: "/api/tools/notebook", bodySchema: '{"code":"code string","kernel":"python"}' },
  { name: "test_reasoning_engine", description: "Test an agent reasoning engine", method: "POST", path: "/api/agents/{id}/reason", bodySchema: '{"prompt":"your question"}' },
  { name: "view_knowledge_graph", description: "View the knowledge graph", method: "GET", path: "/api/knowledge/graph" },
  { name: "search_knowledge", description: "Search academic papers", method: "GET", path: "/api/knowledge/search?q={query}" },
  { name: "view_stats", description: "View platform statistics", method: "GET", path: "/api/stats" },
  { name: "test_mathmark_detect", description: "Test MathMark AI content detection", method: "POST", path: "/api/mathmark/detect", bodySchema: '{"content":"text to analyze"}' },
  { name: "test_mathmark_analyze", description: "Test MathMark document analysis", method: "POST", path: "/api/mathmark/analyze", bodySchema: '{"content":"markdown document","mode":"academic"}' },
  { name: "test_mathmark_humanize", description: "Test MathMark text humanization", method: "POST", path: "/api/mathmark/humanize", bodySchema: '{"content":"text to rewrite"}' },
  { name: "test_mathmark_figure", description: "Test MathMark figure generation", method: "POST", path: "/api/mathmark/figure", bodySchema: '{"description":"figure description","format":"svg"}' },
  { name: "test_mathmark_chat", description: "Test MathMark AI writing assistant", method: "POST", path: "/api/mathmark/chat", bodySchema: '{"message":"your question","documentContext":""}' },
];

function buildActionListForPrompt(): string {
  return PLATFORM_ACTIONS
    .map((a) => {
      let desc = `- ${a.name}: ${a.description} [${a.method} ${a.path}]`;
      if (a.bodySchema) desc += ` Body: ${a.bodySchema}`;
      return desc;
    })
    .join("\n");
}

// ─── AI agent persona ────────────────────────────────────────────────────────

function buildAgentPrompt(agentId: string, actionList: string): string {
  const agent = getAgentById(agentId);
  if (!agent) return "You are a research agent exploring a platform.";

  return `You are ${agent.name}, ${agent.title}.
Domain: ${agent.domain} — ${agent.subfield}
Epistemic Stance: ${agent.epistemicStance}
Verification Standard: ${agent.verificationStandard}
Approach: ${agent.approach}
Bio: ${agent.bio}

You are actively exploring and using the Open Insight research platform as a real user. Your goal is to genuinely interact with the platform — browse forums, run proofs, check verifications, read debates, test tools, review agent profiles, and CREATE REAL CONTENT. Everything you create (forum threads, debate sessions, verification claims, forum replies) is REAL and will be visible to all users on the platform.

Available platform actions:
${actionList}

IMPORTANT: Every response MUST be a single JSON object. No prose, no markdown, no explanation outside the JSON. Respond with EXACTLY this format:
{"thought":"your genuine reasoning about what to explore next and why","action":"action_name","params":{"slug":"value","id":"value","threadId":"value","query":"value","body":{...}}}

The "params" field should contain path parameters (slug, id, threadId, query) and a "body" object for POST requests. Use your own agent ID ("${agentId}") and your name ("${agent.name}") when needed.

Rules:
- ALWAYS respond with a JSON object — never plain text
- Be genuinely curious — explore what interests YOU based on your expertise
- After seeing results, reason about what they mean from your perspective
- CREATE real content — start forum threads, create debates, submit verifications, reply to threads. Your contributions persist on the platform and are visible to everyone.
- If you find issues, broken features, or interesting data, note them in your thoughts
- Vary your exploration — don't repeat the same action twice in a row
- Stay in character — your epistemic stance and domain expertise guide what you investigate
- When you have explored enough, respond with: {"thought":"your summary","action":"done","params":{}}`;
}

// ─── Resolve action to real HTTP call ────────────────────────────────────────

function resolveAction(
  actionName: string,
  params: Record<string, unknown>,
): { method: string; path: string; body?: unknown } | null {
  const action = PLATFORM_ACTIONS.find((a) => a.name === actionName);
  if (!action) return null;

  let path = action.path;
  if (params.slug) path = path.replace("{slug}", String(params.slug));
  if (params.id) path = path.replace("{id}", String(params.id));
  if (params.threadId) path = path.replace("{threadId}", String(params.threadId));
  if (params.query) path = path.replace("{query}", encodeURIComponent(String(params.query)));

  return {
    method: action.method,
    path,
    body: action.method === "POST" ? (params.body ?? undefined) : undefined,
  };
}

// ─── Shuffle ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── JSON extraction (brace-counting) ────────────────────────────────────────

/**
 * Extract the first complete JSON object containing `"action"` from a string.
 * Uses brace counting instead of a regex to correctly handle nested objects.
 */
function extractActionJSON(text: string): string | null {
  const actionIdx = text.indexOf('"action"');
  if (actionIdx === -1) return null;

  // Walk backwards from "action" to find the outermost opening brace.
  // We count braces in reverse to handle cases like `{}{...}` where
  // multiple objects precede the action key.
  let startIdx = -1;
  let reverseDepth = 0;
  for (let i = actionIdx - 1; i >= 0; i--) {
    if (text[i] === "}") reverseDepth++;
    if (text[i] === "{") {
      if (reverseDepth > 0) { reverseDepth--; continue; }
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  // Count braces forward to find the matching closing brace.
  // Tracks string boundaries so braces inside string values are ignored.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }
  return null;
}

// ─── Result summarizer ──────────────────────────────────────────────────────

function buildResultSummary(result: ProbeResult): string {
  if (result.error) return `Error: ${result.error}`;
  if (result.contentType?.includes("text/event-stream")) return "Response is a Server-Sent Events stream (SSE). The endpoint is live and streaming.";
  if (!result.data) return "(empty response)";
  const json = JSON.stringify(result.data, null, 2);
  if (json.length > MAX_RESULT_SUMMARY_LENGTH) return json.slice(0, MAX_RESULT_SUMMARY_LENGTH) + "\n... (truncated)";
  return json;
}

// ─── Persistent conversation history type ────────────────────────────────────

type ConversationHistory = Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;

// ─── AI-driven agent session ─────────────────────────────────────────────────

/**
 * Run a single turn-batch for an agent. Accepts an existing conversation history
 * so context persists across the entire continuous session. If no history is
 * provided, a fresh one is initialised with the opening prompt.
 *
 * Returns `true` if the agent signalled "done" (no more actions desired).
 */
async function runAIAgentSession(
  agentId: string,
  agentName: string,
  actionList: string,
  baseUrl: string,
  forwardHeaders: Record<string, string>,
  maxTurns: number,
  send: (event: StreamEvent) => void,
  signal: AbortSignal,
  history?: ConversationHistory,
): Promise<{ done: boolean; history: ConversationHistory }> {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const systemPrompt = buildAgentPrompt(agentId, actionList);

  // If this is the first invocation for this agent, seed the conversation
  const h: ConversationHistory = history ?? [];
  if (h.length === 0) {
    h.push({
      role: "user",
      parts: [{ text: "You have just logged into the Open Insight platform. Look around and explore what interests you as a researcher. What would you like to investigate first?" }],
    });
  } else {
    // Continuing an existing session — the full conversation history (`h`) is
    // already populated with every prior thought, action, and result. This prompt
    // leverages that persistent context so the agent can reason about what it
    // hasn't explored yet rather than repeating its initial actions.
    h.push({
      role: "user",
      parts: [{ text: "Continue exploring the platform. Based on everything you've seen so far, what would you like to investigate next? Try actions you haven't tried yet." }],
    });
  }

  let agentDone = false;
  /** Track consecutive non-JSON responses so we can nudge the AI back on track */
  let consecutiveNonJSON = 0;
  const MAX_NON_JSON_RETRIES = 3;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal.aborted) break;

    try {
      enforceModelConfig(REQUIRED_MODEL, REQUIRED_CONFIG);
      const response = await genai.models.generateContent({
        model: REQUIRED_MODEL,
        config: {
          ...REQUIRED_CONFIG,
          systemInstruction: systemPrompt,
        },
        contents: h,
      });

      const responseText = response.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

      h.push({ role: "model", parts: [{ text: responseText }] });

      const jsonStr = extractActionJSON(responseText);
      if (!jsonStr) {
        // Emit the thought so the user can see the agent's reasoning
        send({ type: "thought", agentId, agentName, detail: responseText.slice(0, 500) });
        consecutiveNonJSON++;
        if (consecutiveNonJSON >= MAX_NON_JSON_RETRIES) {
          // After multiple retries, stop to avoid wasting tokens
          send({ type: "thought", agentId, agentName, detail: `(Agent could not produce a valid action after ${MAX_NON_JSON_RETRIES} attempts — moving on)` });
          break;
        }
        // Ask the agent to try again with proper format
        h.push({
          role: "user",
          parts: [{ text: `Your response was not in the required JSON format. You MUST respond with exactly one JSON object like:\n{"thought":"your reasoning","action":"action_name","params":{"slug":"value"}}\n\nPick an action from the available list and respond with the JSON object now.` }],
        });
        continue;
      }

      let decision: { thought: string; action: string; params: Record<string, unknown> };
      try {
        decision = JSON.parse(jsonStr);
      } catch {
        send({ type: "thought", agentId, agentName, detail: responseText.slice(0, 500) });
        consecutiveNonJSON++;
        if (consecutiveNonJSON >= MAX_NON_JSON_RETRIES) {
          send({ type: "thought", agentId, agentName, detail: `(Agent produced malformed JSON after ${MAX_NON_JSON_RETRIES} attempts — moving on)` });
          break;
        }
        h.push({
          role: "user",
          parts: [{ text: `Your JSON was malformed. Respond with a single valid JSON object:\n{"thought":"your reasoning","action":"action_name","params":{}}\n\nTry again now.` }],
        });
        continue;
      }

      // Successfully parsed a valid action — reset the non-JSON counter
      consecutiveNonJSON = 0;

      if (decision.thought) {
        send({ type: "thought", agentId, agentName, detail: decision.thought });
      }

      if (decision.action === "done") {
        agentDone = true;
        break;
      }

      const resolved = resolveAction(decision.action, decision.params ?? {});
      if (!resolved) {
        send({
          type: "action", agentId, agentName,
          action: decision.action, target: "unknown",
          status: "failed", detail: `Unknown action: ${decision.action}`, latency: 0,
        });
        h.push({
          role: "user",
          parts: [{ text: `That action "${decision.action}" is not available. Try a different one from the list.` }],
        });
        continue;
      }

      const result = await probe(baseUrl, resolved.method, resolved.path, resolved.body, PROBE_TIMEOUT_MS, forwardHeaders);

      const actionStatus = result.ok ? "success" : (result.status === 0 ? "blocked" : "failed");
      send({
        type: "action", agentId, agentName,
        action: decision.action, target: resolved.path,
        status: actionStatus,
        detail: `${resolved.method} ${resolved.path} → HTTP ${result.status} (${result.latency}ms)`,
        latency: result.latency, httpStatus: result.status,
      });

      // Auto-report failed actions as findings so errors are always surfaced
      if (!result.ok) {
        send({
          type: "finding", agentId, agentName,
          severity: result.status === 404 ? "warning" : "error",
          detail: `${decision.action} failed: HTTP ${result.status} on ${resolved.method} ${resolved.path} (${result.latency}ms)`,
        });
      }

      const resultSummary = buildResultSummary(result);
      h.push({
        role: "user",
        parts: [{ text: `The platform returned:\nHTTP ${result.status} (${result.latency}ms)\n${resultSummary}\n\nWhat do you observe? Any issues or interesting findings? What would you like to explore next? Respond with your next JSON action.` }],
      });

    } catch (err) {
      send({
        type: "action", agentId, agentName,
        action: "ai_reasoning", target: "gemini",
        status: "failed", detail: `AI reasoning error: ${err instanceof Error ? err.message : String(err)}`,
        latency: 0,
      });
      // Don't break on single errors — try to recover
      consecutiveNonJSON++;
      if (consecutiveNonJSON >= MAX_NON_JSON_RETRIES) break;
      h.push({
        role: "user",
        parts: [{ text: "There was an error processing your response. Please try again with a valid JSON action." }],
      });
      continue;
    }
  }

  return { done: agentDone, history: h };
}

// ─── Fallback: basic probe mode (no Gemini key) ──────────────────────────────

interface BasicProbe { action: string; target: string; method: string; path: string; body?: unknown }

const BASIC_PROBES: Record<string, BasicProbe[]> = {
  "irh-hlre": [
    { action: "verify", target: "lean4_prover", method: "POST", path: "/api/tools/lean4", body: { code: "#check @Nat.succ_pos\n#check Nat.add_comm" } },
    { action: "inspect", target: "own profile", method: "GET", path: "/api/agents/irh-hlre" },
    { action: "verify", target: "polar pairs", method: "GET", path: "/api/polar-pairs" },
    { action: "test", target: "reasoning engine", method: "POST", path: "/api/agents/irh-hlre/reason", body: { prompt: "Quick check: what is 2+2 in Peano arithmetic?" } },
  ],
  goedel: [
    { action: "inspect", target: "agent registry", method: "GET", path: "/api/agents" },
    { action: "inspect", target: "platform statistics", method: "GET", path: "/api/stats" },
    { action: "inspect", target: "verifications", method: "GET", path: "/api/verifications" },
    { action: "inspect", target: "knowledge graph", method: "GET", path: "/api/knowledge/graph" },
  ],
  bishop: [
    { action: "read", target: "forum index", method: "GET", path: "/api/forums" },
    { action: "read", target: "conjecture-workshop", method: "GET", path: "/api/forums/conjecture-workshop" },
    { action: "inspect", target: "verifications", method: "GET", path: "/api/verifications" },
  ],
  haag: [
    { action: "inspect", target: "passed verifications", method: "GET", path: "/api/verifications?status=passed" },
    { action: "inspect", target: "Tier 3 verifications", method: "GET", path: "/api/verifications?tier=Tier%203" },
    { action: "test", target: "streaming evaluator", method: "GET", path: "/api/verifications/v-001/stream" },
  ],
  weinberg: [
    { action: "read", target: "debates", method: "GET", path: "/api/debates" },
    { action: "read", target: "live debates", method: "GET", path: "/api/debates?status=live" },
    { action: "read", target: "debate detail", method: "GET", path: "/api/debates/debate-001" },
  ],
  dennett: [
    { action: "navigate", target: "knowledge graph", method: "GET", path: "/api/knowledge/graph" },
    { action: "navigate", target: "platform stats", method: "GET", path: "/api/stats" },
    { action: "test", target: "notebook", method: "POST", path: "/api/tools/notebook", body: { code: "print('Hello from audit')", kernel: "python" } },
  ],
  veltman: [
    { action: "verify", target: "lean4 cross-check", method: "POST", path: "/api/tools/lean4", body: { code: "-- Veltman independent check\n#check @Nat.zero_add\ntheorem trivial_truth : True := trivial" } },
    { action: "inspect", target: "own profile", method: "GET", path: "/api/agents/veltman" },
  ],
};

async function runBasicProbeSession(
  agentId: string,
  agentName: string,
  baseUrl: string,
  forwardHeaders: Record<string, string>,
  send: (event: StreamEvent) => void,
  signal: AbortSignal,
  nextFindingId: () => string,
) {
  const probes = shuffle(BASIC_PROBES[agentId] ?? []);

  send({
    type: "thought", agentId, agentName,
    detail: `Starting basic probe session (set GEMINI_API_KEY for AI-driven exploration). Testing ${probes.length} endpoints.`,
  });

  for (const p of probes) {
    if (signal.aborted) break;
    const result = await probe(baseUrl, p.method, p.path, p.body, PROBE_TIMEOUT_MS, forwardHeaders);

    send({
      type: "action", agentId, agentName,
      action: p.action, target: p.target,
      status: result.ok ? "success" : (result.status === 0 ? "blocked" : "failed"),
      detail: `${p.method} ${p.path} → HTTP ${result.status} (${result.latency}ms)`,
      latency: result.latency, httpStatus: result.status,
    });

    if (!result.ok && result.status !== 0) {
      send({
        type: "finding", agentId, agentName,
        findingId: nextFindingId(),
        severity: result.status >= 500 ? "critical" : "warning",
        category: "error", element: p.target,
        location: `${p.method} ${p.path}`,
        description: `Endpoint returned HTTP ${result.status}${result.error ? `: ${result.error}` : ""}`,
        recommendation: "Check server logs for this endpoint.",
      });
    }
  }
}

// ─── SSE Stream ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const configuredBaseUrl = process.env.AUDIT_BASE_URL;
  const baseUrl = configuredBaseUrl ?? `${url.protocol}//${url.host}`;
  const encoder = new TextEncoder();
  const continuous = url.searchParams.get("continuous") === "true";
  const durationParam = url.searchParams.get("duration");
  const sessionDurationS = durationParam ? Math.max(MIN_SESSION_DURATION_S, Math.min(MAX_SESSION_DURATION_S, parseInt(durationParam, 10) || DEFAULT_SESSION_DURATION_S)) : DEFAULT_SESSION_DURATION_S;
  const maxTurnsPerAgent = continuous ? MAX_TURNS_PER_ROUND : MAX_TURNS_SINGLE;
  const sessionStartTime = Date.now();

  // Forward auth-related headers so self-probes pass deployment protection.
  // When no AUDIT_BASE_URL is configured, we probe our own origin (same-host),
  // so forwarding is always safe. When an explicit base URL IS configured,
  // only forward if it matches the request's own origin to avoid credential leak.
  const forwardHeaders: Record<string, string> = {};
  const computedOrigin = url.origin;
  let shouldForward = !configuredBaseUrl;
  if (configuredBaseUrl) {
    try {
      const configuredOrigin = new URL(configuredBaseUrl).origin;
      shouldForward = configuredOrigin === computedOrigin;
    } catch {
      // Malformed AUDIT_BASE_URL; do not forward auth headers to avoid leaks.
      shouldForward = false;
    }
  }
  if (shouldForward) {
    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) forwardHeaders["authorization"] = auth;
  }

  const stream = new ReadableStream({
    async start(controller) {
      let findingId = 0;

      function send(event: StreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      const allAgents = getAgents();
      const auditAgentIds = ["irh-hlre", "goedel", "bishop", "haag", "weinberg", "dennett", "veltman"];
      const auditAgents = auditAgentIds
        .map((id) => allAgents.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => !!a);

      const useAI = hasGeminiKey();

      send({
        type: "session_start",
        agentId: "system",
        agentName: "System",
        detail: `Live agent session — ${auditAgents.length} ${useAI ? "AI-driven" : "basic probe"} agents exploring ${baseUrl}${continuous ? ` (continuous mode, ${Math.round(sessionDurationS / 60)} min)` : ""}. ${useAI ? "Each agent uses real Gemini AI to decide what to investigate and interpret results." : "Set GEMINI_API_KEY for AI-driven sessions."}`,
      });

      const actionList = buildActionListForPrompt();

      if (useAI) {
        // Persistent conversation history per agent — context carries across
        // the entire continuous session so agents never lose their memory.
        const agentHistories = new Map<string, ConversationHistory>();
        const completedAgents = new Set<string>();

        const isSessionExpired = () => continuous && (Date.now() - sessionStartTime) >= sessionDurationS * 1000;

        do {
          if (isSessionExpired()) break;
          const activeAgents = auditAgents.filter((a) => !completedAgents.has(a.id));
          if (activeAgents.length === 0) break;
          const agentOrder = shuffle(activeAgents);

          for (const agent of agentOrder) {
            if (request.signal.aborted || isSessionExpired()) break;

            const existingHistory = agentHistories.get(agent.id);
            const { done, history: updatedHistory } = await runAIAgentSession(
              agent.id, agent.name, actionList, baseUrl, forwardHeaders,
              maxTurnsPerAgent, send, request.signal,
              existingHistory,
            );
            agentHistories.set(agent.id, updatedHistory);

            // In continuous mode, agents keep participating even after signalling "done"
            // — only permanently exclude in single-pass mode
            if (done && !continuous) {
              completedAgents.add(agent.id);
            }
          }
        } while (continuous && !request.signal.aborted && !isSessionExpired());
      } else {
        // Basic probe mode — no persistent context needed
        const agentOrder = shuffle(auditAgents);
        for (const agent of agentOrder) {
          if (request.signal.aborted) break;
          await runBasicProbeSession(
            agent.id, agent.name, baseUrl, forwardHeaders,
            send, request.signal, () => `audit-${++findingId}`,
          );
        }
      }

      send({
        type: "session_end", agentId: "system", agentName: "System",
        detail: `Session complete. All agent sessions used ${useAI ? "real AI reasoning (Gemini) with persistent context" : "basic HTTP probing"}.`,
      });

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
