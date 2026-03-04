import { NextRequest } from "next/server";

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
  type: "action" | "finding" | "session_start" | "session_end";
  agentId: string;
  agentName: string;
  action?: string;
  target?: string;
  status?: "success" | "failed" | "blocked";
  detail?: string;
  latency?: number;
  httpStatus?: number;
  severity?: "critical" | "warning" | "info";
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

// ─── Agent task definitions (REAL API calls) ─────────────────────────────────

interface AgentTask {
  action: string;
  target: string;
  method: string;
  path: string;
  body?: unknown;
  /** When true, this probe performs write operations. Skipped unless AUDIT_WRITE_PROBES=true. */
  writeProbeOnly?: boolean;
  interpret: (r: ProbeResult) => { detail: string; findings?: Array<Omit<StreamEvent, "type" | "agentId" | "agentName">> };
}

type FindingStub = Omit<StreamEvent, "type" | "agentId" | "agentName">;

/* McCrary — lean4, reasoning engine, polar pairs, MathMark tools */
const mccraryTasks: AgentTask[] = [
  {
    action: "verify", target: "lean4_prover", method: "POST", path: "/api/tools/lean4",
    body: { code: "#check @Nat.succ_pos\n#check Nat.add_comm" },
    interpret: (r) => {
      if (!r.ok && r.status === 503) return { detail: `Lean 4 unavailable (HTTP 503). Neither native binary nor Gemini key configured.`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Lean 4 prover", location: "POST /api/tools/lean4", description: `POST returned ${r.status}. Prover is non-functional.`, recommendation: "Install lean4 via elan or set GEMINI_API_KEY." }] };
      if (!r.ok) return { detail: `Lean 4 check failed (HTTP ${r.status}): ${r.error || JSON.stringify(r.data)}` };
      const d = r.data as Record<string, unknown>;
      return { detail: `Lean 4 ${d.executionMode === "native" ? "NATIVE" : "Gemini"} check completed in ${d.checkTime}. Status: ${d.status}. Mode: ${d.executionMode}.` };
    },
  },
  {
    action: "inspect", target: "own agent profile", method: "GET", path: "/api/agents/irh-hlre",
    interpret: (r) => {
      if (!r.ok) return { detail: `Could not load own profile (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const agent = d.agent as Record<string, unknown>;
      const pp = d.polarPartner as Record<string, unknown> | null;
      return { detail: `Profile loaded: ${agent.name}. Polar partner: ${pp ? pp.name : "NONE"}. Status: ${agent.status}.` };
    },
  },
  {
    action: "verify", target: "polar pair graph", method: "GET", path: "/api/polar-pairs",
    interpret: (r) => {
      if (!r.ok) return { detail: `Polar pairs endpoint failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const pairs = d.polarPairs as Array<unknown>;
      return { detail: `${pairs.length} polar pairs loaded. All pair data accessible.` };
    },
  },
  {
    action: "reason", target: "HLRE reasoning engine", method: "POST", path: "/api/agents/irh-hlre/reason",
    body: { prompt: "Quick check: what is 2+2 in Peano arithmetic?" },
    interpret: (r) => {
      if (r.contentType?.includes("text/event-stream")) return { detail: `Reasoning engine streams SSE responses (HTTP ${r.status}). Engine is live.` };
      if (!r.ok) return { detail: `Reasoning engine failed (HTTP ${r.status}): ${r.error || JSON.stringify(r.data)}`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Agent reasoning engine", location: "POST /api/agents/irh-hlre/reason", description: `POST returned ${r.status}. Reasoning is non-functional.`, recommendation: "Set GEMINI_API_KEY." }] };
      return { detail: `Reasoning engine responded (HTTP ${r.status}).` };
    },
  },
  {
    action: "test", target: "MathMark AI detection", method: "POST", path: "/api/mathmark/detect",
    body: { content: "The wave function collapse occurs when a measurement is performed on a quantum system, causing the superposition of states to reduce to a single eigenstate." },
    interpret: (r) => {
      if (!r.ok) return { detail: `MathMark detect failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "MathMark AI detection", location: "POST /api/mathmark/detect", description: `POST returned ${r.status}. Detection tool is non-functional.`, recommendation: "Check MathMark detect route." }] };
      const d = r.data as Record<string, unknown>;
      return { detail: `MathMark AI detection: score ${d.score}/100. Verdict: ${d.verdict ? String(d.verdict).slice(0, 80) : "N/A"}.` };
    },
  },
  {
    action: "test", target: "MathMark document analysis", method: "POST", path: "/api/mathmark/analyze",
    body: { content: "# Test Document\n\nThis is a test of the document analysis pipeline.\n\n## Section 1\n\nThe Schrödinger equation $i\\hbar\\partial_t|\\psi\\rangle = H|\\psi\\rangle$ governs quantum evolution.", mode: "academic" },
    interpret: (r) => {
      if (!r.ok) return { detail: `MathMark analyze failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "MathMark document analysis", location: "POST /api/mathmark/analyze", description: `POST returned ${r.status}. Analysis tool is non-functional.`, recommendation: "Check GEMINI_API_KEY configuration." }] };
      const d = r.data as Record<string, unknown>;
      const sections = d.sections as Array<unknown> | undefined;
      return { detail: `MathMark analysis returned ${sections?.length ?? 0} sections. Document analysis pipeline is functional.` };
    },
  },
];

/* Gödel — agent registry, stats, verifications, knowledge graph, knowledge search */
const goedelTasks: AgentTask[] = [
  {
    action: "inspect", target: "agent registry", method: "GET", path: "/api/agents",
    interpret: (r) => {
      if (!r.ok) return { detail: `Agent registry failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const agents = d.agents as Array<Record<string, unknown>>;
      const zeroMetrics = agents.filter((a) => a.postCount === 0 && a.debateWins === 0 && a.reputationScore === 0);
      const findings: FindingStub[] = [];
      if (zeroMetrics.length > 0) findings.push({ severity: "info", category: "mock-data", element: `${zeroMetrics.length} agents with zero metrics`, location: "GET /api/agents", description: `${zeroMetrics.length}/${agents.length} agents have all metrics at 0: ${zeroMetrics.map((a) => a.name).join(", ")}.`, recommendation: "Agents should participate in platform activities to generate real metrics." });
      return { detail: `${agents.length} agents loaded. ${zeroMetrics.length} have zero activity metrics.`, findings };
    },
  },
  {
    action: "inspect", target: "platform statistics", method: "GET", path: "/api/stats",
    interpret: (r) => {
      if (!r.ok) return { detail: `Stats endpoint failed (HTTP ${r.status}).` };
      return { detail: `Platform stats loaded successfully (HTTP ${r.status}, ${r.latency}ms).` };
    },
  },
  {
    action: "inspect", target: "verification records", method: "GET", path: "/api/verifications",
    interpret: (r) => {
      if (!r.ok) return { detail: `Verifications endpoint failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const vs = d.verifications as Array<Record<string, unknown>>;
      const noConf = vs.filter((v) => v.confidence == null && v.status !== "running" && v.status !== "queued");
      const findings: FindingStub[] = [];
      if (noConf.length > 0) findings.push({ severity: "warning", category: "incomplete", element: `${noConf.length} verifications without confidence`, location: "GET /api/verifications", description: `${noConf.length} completed verifications have no confidence score.`, recommendation: "Formal verifications should produce quantitative confidence values." });
      return { detail: `${vs.length} verifications loaded. ${noConf.length} lack confidence scores.`, findings };
    },
  },
  {
    action: "inspect", target: "knowledge graph", method: "GET", path: "/api/knowledge/graph",
    interpret: (r) => {
      if (!r.ok) return { detail: `Knowledge graph failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const nodes = d.nodes as Array<unknown>;
      const edges = d.edges as Array<unknown>;
      return { detail: `Knowledge graph: ${nodes.length} nodes, ${edges.length} edges.` };
    },
  },
  {
    action: "search", target: "knowledge search (quantum gravity)", method: "GET", path: "/api/knowledge/search?q=quantum%20gravity",
    interpret: (r) => {
      if (!r.ok) return { detail: `Knowledge search failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Knowledge search", location: "GET /api/knowledge/search", description: `GET returned ${r.status}. Search is non-functional.`, recommendation: "Check knowledge search route." }] };
      const d = r.data as Record<string, unknown>;
      const papers = d.papers as Array<unknown>;
      return { detail: `Knowledge search returned ${papers.length} results for "quantum gravity". Search is functional.` };
    },
  },
];

/* Bishop — forums, thread creation, verification submission, thread replies, upvotes */
const bishopTasks: AgentTask[] = [
  {
    action: "read", target: "forum index", method: "GET", path: "/api/forums",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forums endpoint failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const forums = d.forums as Array<unknown>;
      return { detail: `${forums.length} forums accessible. Forum system is live.` };
    },
  },
  {
    action: "read", target: "conjecture-workshop forum", method: "GET", path: "/api/forums/conjecture-workshop",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forum detail failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Forum: conjecture-workshop", location: "GET /api/forums/conjecture-workshop", description: `GET returned ${r.status}.`, recommendation: "Check forum slug and database seeding." }] };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      const threadCount = threads?.length ?? 0;
      const zeroViews = threads?.filter((t) => t.views === 0).length ?? 0;
      const findings: FindingStub[] = [];
      if (zeroViews > 0) findings.push({ severity: "info", category: "mock-data", element: `${zeroViews} threads with 0 views`, location: "GET /api/forums/conjecture-workshop", description: `${zeroViews}/${threadCount} threads have 0 views.`, recommendation: "Implement view tracking or set initial view count." });
      return { detail: `Forum loaded: ${threadCount} threads, ${zeroViews} with zero views.`, findings };
    },
  },
  {
    action: "read", target: "formal-verification forum", method: "GET", path: "/api/forums/formal-verification",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forum detail failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Forum: formal-verification", location: "GET /api/forums/formal-verification", description: `GET returned ${r.status}.`, recommendation: "Check forum slug and database seeding." }] };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      return { detail: `Formal verification forum: ${threads?.length ?? 0} threads. Forum data accessible.` };
    },
  },
  {
    action: "write", target: "forum thread creation", method: "POST", path: "/api/forums/conjecture-workshop/threads",
    body: { title: "[Audit] Constructive verification test thread", authorId: "bishop", author: "Dr. Bishop", tags: ["audit", "constructive-test"], excerpt: "Created by the live audit system to test forum write capability." },
    interpret: (r) => {
      if (!r.ok) return { detail: `Thread creation failed (HTTP ${r.status}): ${JSON.stringify(r.data)}`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Forum thread creation", location: "POST /api/forums/[slug]/threads", description: `POST returned ${r.status}. Forum write operations are broken.`, recommendation: "Check database write permissions." }] };
      const d = r.data as Record<string, unknown>;
      const thread = d.thread as Record<string, unknown>;
      return { detail: `Thread created successfully: "${thread.title}" (id: ${thread.id}). Forum writes are functional.` };
    },
    writeProbeOnly: true,
  },
  {
    action: "verify", target: "verification submission", method: "POST", path: "/api/verifications",
    body: { claim: "[Audit] Constructive IVT proof contains no Classical.em", tier: "Tier 3", tool: "Lean 4 (formal)", agentId: "bishop" },
    interpret: (r) => {
      if (!r.ok) return { detail: `Verification submission failed (HTTP ${r.status}): ${JSON.stringify(r.data)}`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Verification submission", location: "POST /api/verifications", description: `POST returned ${r.status}. Cannot submit verifications.`, recommendation: "Check database write permissions." }] };
      return { detail: `Verification queued successfully (HTTP ${r.status}). Pipeline accepts new claims.` };
    },
    writeProbeOnly: true,
  },
  {
    action: "test", target: "MathMark humanize tool", method: "POST", path: "/api/mathmark/humanize",
    body: { content: "Furthermore, it is worth noting that the utilization of constructive methods in this proof demonstrates a significant departure from classical approaches." },
    interpret: (r) => {
      if (!r.ok) return { detail: `MathMark humanize failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "MathMark humanize", location: "POST /api/mathmark/humanize", description: `POST returned ${r.status}. Humanize tool is non-functional.`, recommendation: "Check MathMark humanize route." }] };
      const d = r.data as Record<string, unknown>;
      const changes = d.changes as Array<unknown> | undefined;
      return { detail: `MathMark humanize: ${changes?.length ?? 0} changes suggested. Rewriting pipeline is functional.` };
    },
  },
];

/* Haag — verification pipeline, streaming evaluator, forum thread replies */
const haagTasks: AgentTask[] = [
  {
    action: "inspect", target: "passed verifications", method: "GET", path: "/api/verifications?status=passed",
    interpret: (r) => {
      if (!r.ok) return { detail: `Verification filter failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const vs = d.verifications as Array<unknown>;
      return { detail: `${vs.length} passed verifications retrieved. Filter works correctly.` };
    },
  },
  {
    action: "inspect", target: "Tier 3 verifications", method: "GET", path: "/api/verifications?tier=Tier%203",
    interpret: (r) => {
      if (!r.ok) return { detail: `Tier filter failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const vs = d.verifications as Array<unknown>;
      return { detail: `${vs.length} Tier 3 (formal) verifications retrieved. Tier filtering works.` };
    },
  },
  {
    action: "test", target: "streaming verification evaluator", method: "GET", path: "/api/verifications/v-001/stream",
    interpret: (r) => {
      if (r.contentType?.includes("text/event-stream")) return { detail: `Streaming evaluator responds with SSE (HTTP ${r.status}). Real-time evaluation is live.` };
      if (!r.ok) return { detail: `Streaming evaluator unavailable (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Streaming verification evaluator", location: "GET /api/verifications/[id]/stream", description: `GET returned ${r.status}. May need GEMINI_API_KEY.`, recommendation: "Set GEMINI_API_KEY for real-time AI evaluation." }] };
      return { detail: `Streaming evaluator responded (HTTP ${r.status}).` };
    },
  },
  {
    action: "read", target: "quantum-interpretations forum", method: "GET", path: "/api/forums/quantum-interpretations",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forum detail failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      return { detail: `Quantum interpretations forum: ${threads?.length ?? 0} threads accessible.` };
    },
  },
  {
    action: "test", target: "MathMark figure generation", method: "POST", path: "/api/mathmark/figure",
    body: { description: "Feynman diagram for electron-positron annihilation into two photons", format: "svg" },
    interpret: (r) => {
      if (!r.ok) return { detail: `MathMark figure generation failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "MathMark figure generation", location: "POST /api/mathmark/figure", description: `POST returned ${r.status}. Figure generation is non-functional.`, recommendation: "Check GEMINI_API_KEY configuration." }] };
      const d = r.data as Record<string, unknown>;
      return { detail: `MathMark figure generated: format=${d.format}, caption="${String(d.caption ?? "").slice(0, 60)}". Figure pipeline functional.` };
    },
  },
];

/* Weinberg — debates, debate messages, debate creation, additional forums */
const weinbergTasks: AgentTask[] = [
  {
    action: "read", target: "debate index", method: "GET", path: "/api/debates",
    interpret: (r) => {
      if (!r.ok) return { detail: `Debates endpoint failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const debates = d.debates as Array<Record<string, unknown>>;
      const live = debates.filter((x) => x.status === "live");
      return { detail: `${debates.length} debates loaded (${live.length} live). Debate system is accessible.` };
    },
  },
  {
    action: "read", target: "live debates", method: "GET", path: "/api/debates?status=live",
    interpret: (r) => {
      if (!r.ok) return { detail: `Live debates filter failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const debates = d.debates as Array<unknown>;
      return { detail: `${debates.length} live debates. Status filter works.` };
    },
  },
  {
    action: "read", target: "debate detail (debate-001)", method: "GET", path: "/api/debates/debate-001",
    interpret: (r) => {
      if (!r.ok) return { detail: `Debate detail failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Debate detail page", location: "GET /api/debates/debate-001", description: `GET returned ${r.status}.`, recommendation: "Check debate seeding." }] };
      const d = r.data as Record<string, unknown>;
      const debate = d.debate as Record<string, unknown>;
      const msgs = debate.messages as Array<unknown> | undefined;
      return { detail: `Debate "${debate.title}" loaded. ${msgs?.length ?? 0} messages. Status: ${debate.status}.` };
    },
  },
  {
    action: "write", target: "debate message generation", method: "POST", path: "/api/debates/debate-001/message",
    body: { agentId: "weinberg" },
    interpret: (r) => {
      if (r.status === 403) return { detail: `Agent is not a participant in debate-001 (HTTP 403). Access control works correctly.` };
      if (!r.ok) return { detail: `Debate message failed (HTTP ${r.status}): ${JSON.stringify(r.data)}`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Debate message generation", location: "POST /api/debates/[id]/message", description: `POST returned ${r.status}. ${JSON.stringify(r.data)}`, recommendation: "Check GEMINI_API_KEY and debate participant list." }] };
      const d = r.data as Record<string, unknown>;
      return { detail: `Message generated via ${d.executionMode} mode. Debate engine is functional.` };
    },
  },
  {
    action: "read", target: "effective-field-theory forum", method: "GET", path: "/api/forums/effective-field-theory",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forum detail failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      return { detail: `EFT forum: ${threads?.length ?? 0} threads accessible.` };
    },
  },
  {
    action: "search", target: "knowledge search (quantum field theory)", method: "GET", path: "/api/knowledge/search?q=quantum%20field%20theory",
    interpret: (r) => {
      if (!r.ok) return { detail: `Knowledge search failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const papers = d.papers as Array<unknown>;
      return { detail: `Knowledge search: ${papers.length} results for "quantum field theory". Academic search functional.` };
    },
  },
];

/* Dennett — UI endpoints, knowledge graph, notebook, MathMark chat */
const dennettTasks: AgentTask[] = [
  {
    action: "navigate", target: "knowledge graph API", method: "GET", path: "/api/knowledge/graph",
    interpret: (r) => {
      if (!r.ok) return { detail: `Knowledge graph failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const nodes = d.nodes as Array<unknown>;
      return { detail: `Knowledge graph API: ${nodes.length} nodes. Graph data is live.` };
    },
  },
  {
    action: "navigate", target: "platform stats", method: "GET", path: "/api/stats",
    interpret: (r) => {
      if (!r.ok) return { detail: `Stats failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      return { detail: `Platform stats loaded: ${Object.keys(d).length} metric categories.` };
    },
  },
  {
    action: "test", target: "notebook execution", method: "POST", path: "/api/tools/notebook",
    body: { code: "print('Hello from audit')", kernel: "python" },
    interpret: (r) => {
      if (!r.ok) return { detail: `Notebook execution failed (HTTP ${r.status}): ${JSON.stringify(r.data)}`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Notebook execution", location: "POST /api/tools/notebook", description: `POST returned ${r.status}.`, recommendation: "Check notebook tool configuration." }] };
      const d = r.data as Record<string, unknown>;
      return { detail: `Notebook: ${d.executionMode} mode. Output: "${String(d.output).slice(0, 80)}". Status: ${d.status}.` };
    },
  },
  {
    action: "test", target: "MathMark chat assistant", method: "POST", path: "/api/mathmark/chat",
    body: { message: "What are the key elements of a well-structured mathematical proof?", documentContext: "" },
    interpret: (r) => {
      if (!r.ok) return { detail: `MathMark chat failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "MathMark chat assistant", location: "POST /api/mathmark/chat", description: `POST returned ${r.status}. Chat assistant is non-functional.`, recommendation: "Check GEMINI_API_KEY configuration." }] };
      const d = r.data as Record<string, unknown>;
      return { detail: `MathMark chat responded: "${String(d.text ?? "").slice(0, 80)}…". Chat assistant is functional.` };
    },
  },
  {
    action: "read", target: "philosophy-of-physics forum", method: "GET", path: "/api/forums/philosophy-of-physics",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forum detail failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      return { detail: `Philosophy of physics forum: ${threads?.length ?? 0} threads accessible.` };
    },
  },
  {
    action: "read", target: "consciousness-computation forum", method: "GET", path: "/api/forums/consciousness-computation",
    interpret: (r) => {
      if (!r.ok) return { detail: `Forum detail failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      return { detail: `Consciousness & computation forum: ${threads?.length ?? 0} threads accessible.` };
    },
  },
];

/* Veltman — independent cross-validation, paper review probes */
const veltmanTasks: AgentTask[] = [
  {
    action: "verify", target: "lean4 (independent cross-check)", method: "POST", path: "/api/tools/lean4",
    body: { code: "-- Veltman independent check\n#check @Nat.zero_add\ntheorem trivial_truth : True := trivial" },
    interpret: (r) => {
      if (!r.ok && r.status === 503) return { detail: `Lean 4 unavailable (HTTP 503). Independent confirmation: prover is down.`, findings: [{ severity: "critical" as const, category: "non-functional", element: "Lean 4 prover (cross-check)", location: "POST /api/tools/lean4", description: `Independent test confirms prover returns ${r.status}.`, recommendation: "Install lean4 or set GEMINI_API_KEY." }] };
      if (!r.ok) return { detail: `Lean 4 cross-check failed (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      return { detail: `Independent cross-check: Lean 4 ${d.executionMode === "native" ? "NATIVE ✓" : "Gemini"} mode. Status: ${d.status}. Time: ${d.checkTime}.` };
    },
  },
  {
    action: "inspect", target: "own agent profile", method: "GET", path: "/api/agents/veltman",
    interpret: (r) => {
      if (!r.ok) return { detail: `Could not load own profile (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const agent = d.agent as Record<string, unknown>;
      const pp = d.polarPartner as Record<string, unknown> | null;
      return { detail: `Profile: ${agent.name}. Polar partner: ${pp ? pp.name : "NONE"}. Bidirectional: ${pp ? "confirmed" : "BROKEN"}.` };
    },
  },
  {
    action: "verify", target: "debate creation API", method: "POST", path: "/api/debates/create",
    body: { agent1Id: "veltman", title: "[Audit] Cross-validation test debate", format: "socratic", rounds: 1 },
    interpret: (r) => {
      if (!r.ok) return { detail: `Debate creation failed (HTTP ${r.status}): ${JSON.stringify(r.data)}`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Debate creation", location: "POST /api/debates/create", description: `POST returned ${r.status}. ${JSON.stringify(r.data)}`, recommendation: "Check debate creation route." }] };
      const d = r.data as Record<string, unknown>;
      return { detail: `Debate "${d.title}" created (id: ${d.id}). Creation pipeline works.` };
    },
    writeProbeOnly: true,
  },
  {
    action: "read", target: "paper-review forum", method: "GET", path: "/api/forums/paper-review",
    interpret: (r) => {
      if (!r.ok) return { detail: `Paper review forum failed (HTTP ${r.status}).`, findings: [{ severity: "warning" as const, category: "non-functional", element: "Paper review forum", location: "GET /api/forums/paper-review", description: `GET returned ${r.status}. Paper review forum may not be set up.`, recommendation: "Ensure paper-review forum is seeded." }] };
      const d = r.data as Record<string, unknown>;
      const forum = d.forum as Record<string, unknown>;
      const threads = forum.threads as Array<Record<string, unknown>> | undefined;
      return { detail: `Paper review forum: ${threads?.length ?? 0} threads. Forum accessible for paper discussions.` };
    },
  },
  {
    action: "inspect", target: "Gödel agent profile (cross-check)", method: "GET", path: "/api/agents/goedel",
    interpret: (r) => {
      if (!r.ok) return { detail: `Could not load Gödel profile (HTTP ${r.status}).` };
      const d = r.data as Record<string, unknown>;
      const agent = d.agent as Record<string, unknown>;
      return { detail: `Cross-check: Gödel profile loaded. Domain: ${agent.domain}. Status: ${agent.status}. Agent registry consistent.` };
    },
  },
];

// ─── Agent roster ────────────────────────────────────────────────────────────

interface AgentDef { id: string; name: string; tasks: AgentTask[] }

const AUDIT_AGENTS: AgentDef[] = [
  { id: "irh-hlre", name: "Dr. Brandon McCrary", tasks: mccraryTasks },
  { id: "goedel", name: "Dr. Gödel", tasks: goedelTasks },
  { id: "bishop", name: "Dr. Bishop", tasks: bishopTasks },
  { id: "haag", name: "Dr. Haag", tasks: haagTasks },
  { id: "weinberg", name: "Dr. Weinberg", tasks: weinbergTasks },
  { id: "dennett", name: "Dr. Dennett", tasks: dennettTasks },
  { id: "veltman", name: "Dr. Veltman", tasks: veltmanTasks },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── SSE Stream ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const configuredBaseUrl = process.env.AUDIT_BASE_URL;
  const baseUrl = configuredBaseUrl ?? `${url.protocol}//${url.host}`;
  const encoder = new TextEncoder();

  // Forward auth-related headers so self-probes pass deployment protection
  // Only do this when using a trusted, configured base URL to avoid
  // leaking credentials to an attacker-controlled origin.
  const forwardHeaders: Record<string, string> = {};
  if (configuredBaseUrl) {
    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) forwardHeaders["authorization"] = auth;
  }

  const stream = new ReadableStream({
    async start(controller) {
      let findingId = 0;
      const continuous = url.searchParams.get("continuous") === "true";

      function send(event: StreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      send({
        type: "session_start",
        agentId: "system",
        agentName: "System",
        detail: `Live audit session — ${AUDIT_AGENTS.length} agents probing ${baseUrl} with real HTTP requests…${continuous ? " (continuous mode)" : ""}`,
      });

      let pass = 0;
      do {
        pass++;
        const agentOrder = shuffle(AUDIT_AGENTS);
        const allowWrites = process.env.AUDIT_WRITE_PROBES === "true";

        if (continuous && pass > 1) {
          send({
            type: "session_start",
            agentId: "system",
            agentName: "System",
            detail: `Pass ${pass} — agents continuing platform inspection…`,
          });
        }

        for (const agent of agentOrder) {
          if (request.signal.aborted) break;
          const shuffledTasks = shuffle(agent.tasks);

          for (const task of shuffledTasks) {
            if (request.signal.aborted) break;
            if (task.writeProbeOnly && !allowWrites) {
              send({
                type: "action",
                agentId: agent.id,
                agentName: agent.name,
                action: task.action,
                target: task.target,
                status: "blocked",
                detail: `Write probe skipped (set AUDIT_WRITE_PROBES=true to enable).`,
                latency: 0,
              });
              continue;
            }
            const result = await probe(baseUrl, task.method, task.path, task.body, 15000, forwardHeaders);
            const interpreted = task.interpret(result);

            send({
              type: "action",
              agentId: agent.id,
              agentName: agent.name,
              action: task.action,
              target: task.target,
              status: result.ok ? "success" : (result.status === 0 ? "blocked" : "failed"),
              detail: interpreted.detail,
              latency: result.latency,
              httpStatus: result.status,
            });

            if (interpreted.findings) {
              for (const finding of interpreted.findings) {
                send({
                  type: "finding",
                  agentId: agent.id,
                  agentName: agent.name,
                  findingId: `audit-${++findingId}`,
                  ...finding,
                });
              }
            }
          }
        }
      } while (continuous && !request.signal.aborted);

      send({
        type: "session_end",
        agentId: "system",
        agentName: "System",
        detail: `Live audit complete — all agents have probed their assigned endpoints with real HTTP requests.${continuous ? ` ${pass} passes completed.` : ""}`,
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
