import { NextRequest, NextResponse } from "next/server";

export interface AgentAction {
  agentId: string;
  agentName: string;
  action: string;
  target: string;
  status: "success" | "failed" | "blocked";
  detail: string;
  latency?: number;
  httpStatus?: number;
}

export interface AuditFinding {
  id: string;
  agentId: string;
  agentName: string;
  severity: "critical" | "warning" | "info";
  category: string;
  element: string;
  location: string;
  description: string;
  recommendation: string;
}

export interface AuditReport {
  timestamp: string;
  mode: "live";
  actions: AgentAction[];
  findings: AuditFinding[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
    actionsAttempted: number;
    actionsSucceeded: number;
    actionsFailed: number;
  };
  agentParticipants: string[];
}

// ─── Real HTTP probe ─────────────────────────────────────────────────────────

interface ProbeResult {
  ok: boolean;
  status: number;
  latency: number;
  data?: unknown;
  error?: string;
  contentType?: string;
}

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
    try { data = await res.json(); } catch { data = null; /* Non-JSON or empty response body */ }
    return { ok: res.ok, status: res.status, data, latency, contentType };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false, status: 0,
      error: err instanceof Error ? err.message : String(err),
      latency: Date.now() - start,
    };
  }
}

// ─── Endpoint probes per agent ───────────────────────────────────────────────

interface EndpointProbe {
  agentId: string;
  agentName: string;
  action: string;
  target: string;
  method: string;
  path: string;
  body?: unknown;
  interpret: (r: ProbeResult) => { detail: string; findings?: Array<Omit<AuditFinding, "id" | "agentId" | "agentName">> };
}

function buildProbes(): EndpointProbe[] {
  return [
    // McCrary — lean4, reasoning, polar pairs
    { agentId: "irh-hlre", agentName: "Dr. Brandon McCrary", action: "verify", target: "lean4_prover", method: "POST", path: "/api/tools/lean4", body: { code: "#check @Nat.succ_pos" },
      interpret: (r) => {
        if (!r.ok && r.status === 503) return { detail: `Lean 4 unavailable (HTTP 503).`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Lean 4 prover", location: "POST /api/tools/lean4", description: `POST returned ${r.status}. Prover non-functional.`, recommendation: "Install lean4 or set GEMINI_API_KEY." }] };
        if (!r.ok) return { detail: `Lean 4 failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        return { detail: `Lean 4 ${d.executionMode} check: ${d.status} in ${d.checkTime}.` };
      },
    },
    { agentId: "irh-hlre", agentName: "Dr. Brandon McCrary", action: "inspect", target: "own profile", method: "GET", path: "/api/agents/irh-hlre",
      interpret: (r) => {
        if (!r.ok) return { detail: `Profile failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const agent = d.agent as Record<string, unknown>;
        return { detail: `Profile: ${agent.name}. Status: ${agent.status}.` };
      },
    },
    { agentId: "irh-hlre", agentName: "Dr. Brandon McCrary", action: "verify", target: "polar pairs", method: "GET", path: "/api/polar-pairs",
      interpret: (r) => {
        if (!r.ok) return { detail: `Polar pairs failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const pairs = d.polarPairs as Array<unknown>;
        return { detail: `${pairs.length} polar pairs loaded.` };
      },
    },
    { agentId: "irh-hlre", agentName: "Dr. Brandon McCrary", action: "reason", target: "reasoning engine", method: "POST", path: "/api/agents/irh-hlre/reason", body: { prompt: "2+2 in Peano?" },
      interpret: (r) => {
        if (r.contentType?.includes("text/event-stream")) return { detail: `Reasoning engine SSE live (HTTP ${r.status}).` };
        if (!r.ok) return { detail: `Reasoning failed (HTTP ${r.status}).`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Agent reasoning engine", location: "POST /api/agents/irh-hlre/reason", description: `POST returned ${r.status}.`, recommendation: "Set GEMINI_API_KEY." }] };
        return { detail: `Reasoning responded (HTTP ${r.status}).` };
      },
    },
    // Gödel — agents, stats, verifications
    { agentId: "goedel", agentName: "Dr. Gödel", action: "inspect", target: "agent registry", method: "GET", path: "/api/agents",
      interpret: (r) => {
        if (!r.ok) return { detail: `Agent registry failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const agents = d.agents as Array<Record<string, unknown>>;
        return { detail: `${agents.length} agents loaded.` };
      },
    },
    { agentId: "goedel", agentName: "Dr. Gödel", action: "inspect", target: "stats", method: "GET", path: "/api/stats",
      interpret: (r) => ({ detail: r.ok ? `Stats loaded (${r.latency}ms).` : `Stats failed (HTTP ${r.status}).` }),
    },
    { agentId: "goedel", agentName: "Dr. Gödel", action: "inspect", target: "verifications", method: "GET", path: "/api/verifications",
      interpret: (r) => {
        if (!r.ok) return { detail: `Verifications failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const vs = d.verifications as Array<unknown>;
        return { detail: `${vs.length} verifications loaded.` };
      },
    },
    { agentId: "goedel", agentName: "Dr. Gödel", action: "inspect", target: "knowledge graph", method: "GET", path: "/api/knowledge/graph",
      interpret: (r) => {
        if (!r.ok) return { detail: `Knowledge graph failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const nodes = d.nodes as Array<unknown>;
        return { detail: `Knowledge graph: ${nodes.length} nodes.` };
      },
    },
    // Bishop — forums, thread creation
    { agentId: "bishop", agentName: "Dr. Bishop", action: "read", target: "forums", method: "GET", path: "/api/forums",
      interpret: (r) => {
        if (!r.ok) return { detail: `Forums failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const forums = d.forums as Array<unknown>;
        return { detail: `${forums.length} forums accessible.` };
      },
    },
    { agentId: "bishop", agentName: "Dr. Bishop", action: "verify", target: "verification endpoint", method: "GET", path: "/api/verifications",
      interpret: (r) => {
        if (!r.ok) return { detail: `Verification endpoint failed (HTTP ${r.status}).`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Verification submission", location: "GET /api/verifications", description: `GET returned ${r.status}.`, recommendation: "Check database read permissions and verification service availability." }] };
        const d = r.data as Record<string, unknown>;
        const vs = (d.verifications as Array<unknown>) ?? [];
        return { detail: `${vs.length} verifications accessible (HTTP ${r.status}).` };
      },
    },
    // Haag — verification pipeline
    { agentId: "haag", agentName: "Dr. Haag", action: "inspect", target: "passed verifications", method: "GET", path: "/api/verifications?status=passed",
      interpret: (r) => {
        if (!r.ok) return { detail: `Verification filter failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const vs = d.verifications as Array<unknown>;
        return { detail: `${vs.length} passed verifications.` };
      },
    },
    { agentId: "haag", agentName: "Dr. Haag", action: "test", target: "streaming evaluator", method: "GET", path: "/api/verifications/v-001/stream",
      interpret: (r) => {
        if (r.contentType?.includes("text/event-stream")) return { detail: `Streaming evaluator SSE live (HTTP ${r.status}).` };
        if (!r.ok) return { detail: `Streaming evaluator unavailable (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Streaming evaluator", location: "GET /api/verifications/[id]/stream", description: `GET returned ${r.status}.`, recommendation: "Set GEMINI_API_KEY." }] };
        return { detail: `Evaluator responded (HTTP ${r.status}).` };
      },
    },
    // Weinberg — debates
    { agentId: "weinberg", agentName: "Dr. Weinberg", action: "read", target: "debates", method: "GET", path: "/api/debates",
      interpret: (r) => {
        if (!r.ok) return { detail: `Debates failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const debates = d.debates as Array<unknown>;
        return { detail: `${debates.length} debates loaded.` };
      },
    },
    { agentId: "weinberg", agentName: "Dr. Weinberg", action: "read", target: "debate detail", method: "GET", path: "/api/debates/debate-001",
      interpret: (r) => {
        if (!r.ok) return { detail: `Debate detail failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const debate = d.debate as Record<string, unknown>;
        return { detail: `Debate "${debate.title}" loaded.` };
      },
    },
    // Dennett — UI endpoints
    { agentId: "dennett", agentName: "Dr. Dennett", action: "navigate", target: "knowledge graph", method: "GET", path: "/api/knowledge/graph",
      interpret: (r) => {
        if (!r.ok) return { detail: `Knowledge graph failed (HTTP ${r.status}).` };
        return { detail: `Knowledge graph API live (${r.latency}ms).` };
      },
    },
    { agentId: "dennett", agentName: "Dr. Dennett", action: "test", target: "notebook", method: "POST", path: "/api/tools/notebook",
      body: { code: "print('audit')", kernel: "python" },
      interpret: (r) => {
        if (!r.ok) return { detail: `Notebook failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        return { detail: `Notebook: ${d.executionMode} mode. Status: ${d.status}.` };
      },
    },
    // Veltman — independent cross-validation
    { agentId: "veltman", agentName: "Dr. Veltman", action: "verify", target: "lean4 cross-check", method: "POST", path: "/api/tools/lean4",
      body: { code: "#check @Nat.zero_add" },
      interpret: (r) => {
        if (!r.ok && r.status === 503) return { detail: `Lean 4 independently confirmed down (HTTP 503).`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Lean 4 (cross-check)", location: "POST /api/tools/lean4", description: `Independent test: ${r.status}.`, recommendation: "Install lean4 or set GEMINI_API_KEY." }] };
        if (!r.ok) return { detail: `Lean 4 cross-check failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        return { detail: `Cross-check: Lean 4 ${d.executionMode} mode. Status: ${d.status}.` };
      },
    },
    { agentId: "veltman", agentName: "Dr. Veltman", action: "inspect", target: "own profile", method: "GET", path: "/api/agents/veltman",
      interpret: (r) => {
        if (!r.ok) return { detail: `Profile failed (HTTP ${r.status}).` };
        const d = r.data as Record<string, unknown>;
        const agent = d.agent as Record<string, unknown>;
        return { detail: `Profile: ${agent.name}. Status: ${agent.status}.` };
      },
    },
  ];
}

/**
 * Live audit: each agent makes REAL HTTP requests to platform API endpoints
 * and reports actual results — no hardcoded findings.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const computedOrigin = `${url.protocol}//${url.host}`;
  const canonicalOrigin = process.env.CANONICAL_ORIGIN;

  // Prefer a canonical origin if configured; otherwise fall back to the computed origin.
  // This is used as the base URL for internal self-probes.
  const baseUrl = canonicalOrigin || computedOrigin;

  // Forward auth-related headers only when we are confident the request is targeting
  // our canonical origin. This avoids SSRF + credential exfiltration via Host spoofing.
  const forwardHeaders: Record<string, string> = {};
  const shouldForwardSensitiveHeaders =
    canonicalOrigin !== undefined && canonicalOrigin === computedOrigin;

  if (shouldForwardSensitiveHeaders) {
    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) forwardHeaders["authorization"] = auth;
  }
  const actions: AgentAction[] = [];
  const findings: AuditFinding[] = [];
  let findingId = 0;

  const probes = buildProbes();

  for (const p of probes) {
    const result = await probe(baseUrl, p.method, p.path, p.body, 15000, forwardHeaders);
    const interpreted = p.interpret(result);

    actions.push({
      agentId: p.agentId,
      agentName: p.agentName,
      action: p.action,
      target: p.target,
      status: result.ok ? "success" : (result.status === 0 ? "blocked" : "failed"),
      detail: interpreted.detail,
      latency: result.latency,
      httpStatus: result.status,
    });

    if (interpreted.findings) {
      for (const f of interpreted.findings) {
        findings.push({
          id: `audit-${++findingId}`,
          agentId: p.agentId,
          agentName: p.agentName,
          ...f,
        });
      }
    }
  }

  const participatingAgents = [...new Set(actions.map((a) => a.agentName))];

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    mode: "live",
    actions,
    findings,
    summary: {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
      actionsAttempted: actions.length,
      actionsSucceeded: actions.filter((a) => a.status === "success").length,
      actionsFailed: actions.filter((a) => a.status === "failed" || a.status === "blocked").length,
    },
    agentParticipants: participatingAgents,
  };

  return NextResponse.json(report);
}
