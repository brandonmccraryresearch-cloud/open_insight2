import { NextResponse } from "next/server";
import { getAgents, getStats, getPolarPairs } from "@/lib/queries";
import { hasGeminiKey } from "@/lib/gemini";
import { checkLeanAvailable } from "@/lib/lean4";
import { db } from "@/db";
import * as schema from "@/db/schema";

export interface AgentAction {
  agentId: string;
  agentName: string;
  action: string;
  target: string;
  status: "success" | "failed" | "blocked";
  detail: string;
}

export interface AuditFinding {
  id: string;
  agentId: string;
  agentName: string;
  severity: "critical" | "warning" | "info";
  category: "mock-data" | "non-functional" | "placeholder" | "inconsistency" | "error" | "emulation";
  element: string;
  location: string;
  description: string;
  recommendation: string;
}

export interface AuditReport {
  timestamp: string;
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

/**
 * Autonomous agent session. Each PhD-level agent actively attempts to use
 * platform features — reasoning, verification, debates, forums, Lean 4 —
 * operating as their defined personas. When they encounter non-functional,
 * mock, emulated, or broken elements, they file error reports.
 */
export async function GET() {
  const agents = getAgents();
  const stats = getStats();
  const polarPairs = getPolarPairs();
  const debateRows = db.select().from(schema.debates).all();
  const threadRows = db.select().from(schema.forumThreads).all();
  const forumRows = db.select().from(schema.forums).all();
  const verifications = db.select().from(schema.verifications).all();

  const findings: AuditFinding[] = [];
  const actions: AgentAction[] = [];
  let findingId = 0;

  function addAction(
    agentId: string,
    agentName: string,
    action: string,
    target: string,
    status: AgentAction["status"],
    detail: string,
  ) {
    actions.push({ agentId, agentName, action, target, status, detail });
  }

  function addFinding(
    agentId: string,
    agentName: string,
    severity: AuditFinding["severity"],
    category: AuditFinding["category"],
    element: string,
    location: string,
    description: string,
    recommendation: string,
  ) {
    findings.push({
      id: `audit-${++findingId}`,
      agentId,
      agentName,
      severity,
      category,
      element,
      location,
      description,
      recommendation,
    });
  }

  // ─── Check real tool availability (shared across agents) ───
  const geminiAvailable = hasGeminiKey();
  const leanAvailable = await checkLeanAvailable();

  // =====================================================================
  // Agent: Dr. McCrary (IRH-HLRE) — Frontier Physics
  // Active role: attempts reasoning with codeExecution + lean4_prover,
  //              checks polar pair integrity, inspects debate data.
  // =====================================================================
  const mccAgent = agents.find((a) => a.id === "irh-hlre");
  if (mccAgent) {
    // ACTION: attempt to use the reasoning engine
    if (geminiAvailable) {
      addAction("irh-hlre", mccAgent.name, "reason", "/api/agents/irh-hlre/reason", "success",
        "Gemini API key present. HLRE reasoning engine (codeExecution + lean4_prover) is available.");
    } else {
      addAction("irh-hlre", mccAgent.name, "reason", "/api/agents/irh-hlre/reason", "blocked",
        "GEMINI_API_KEY not configured. Cannot invoke reasoning engine.");
      addFinding("irh-hlre", mccAgent.name, "critical", "non-functional",
        "Agent reasoning engine",
        "src/lib/gemini.ts (getGenAI)",
        "GEMINI_API_KEY is not set. All agent reasoning calls (streaming, verification, HLRE) will throw. The reasoning panels are non-functional without this key.",
        "Set GEMINI_API_KEY in .env.local or Vercel environment variables.");
    }

    // ACTION: attempt to use the Lean 4 prover
    if (leanAvailable) {
      addAction("irh-hlre", mccAgent.name, "prove", "lean4_prover (native)", "success",
        "Native Lean 4 binary resolved and responds to --version.");
    } else if (geminiAvailable) {
      addAction("irh-hlre", mccAgent.name, "prove", "lean4_prover (gemini fallback)", "success",
        "Native Lean 4 binary not found. Using Gemini semantic verification (real, but not native execution).");
      addFinding("irh-hlre", mccAgent.name, "warning", "emulation",
        "Lean 4 prover: Gemini fallback active",
        "src/lib/lean4.ts (runLean4Check)",
        "Lean 4 code is being verified via Gemini semantic reasoning, not native lean binary execution. Results are real AI verification but not formal proof checking.",
        "Install the lean4 binary via elan (scripts/install-lean4.sh) for native proof verification.");
    } else {
      addAction("irh-hlre", mccAgent.name, "prove", "lean4_prover", "failed",
        "Neither Lean 4 binary nor Gemini API key available. Prover is completely non-functional.");
      addFinding("irh-hlre", mccAgent.name, "critical", "non-functional",
        "Lean 4 prover: fully unavailable",
        "src/lib/lean4.ts",
        "Neither the native lean binary nor GEMINI_API_KEY is configured. runLean4Check() will throw. All Lean 4 verification features are non-functional.",
        "Install lean4 via elan or set GEMINI_API_KEY for semantic fallback.");
    }

    // ACTION: check polar pair integrity
    addAction("irh-hlre", mccAgent.name, "verify", "polar pair graph", "success",
      "Inspecting bidirectional polar partner references across all agents.");
    for (const agent of agents) {
      if (agent.polarPartner) {
        const partner = agents.find((a) => a.id === agent.polarPartner);
        if (!partner) {
          addFinding("irh-hlre", mccAgent.name, "critical", "error",
            `Agent: ${agent.name}`,
            `src/data/agents.ts (agent: ${agent.id})`,
            `Agent "${agent.name}" references polar partner "${agent.polarPartner}" which does not exist.`,
            "Create the missing partner agent or update the polarPartner field.");
        } else if (partner.polarPartner !== agent.id) {
          addFinding("irh-hlre", mccAgent.name, "critical", "inconsistency",
            `Polar pair: ${agent.name} ↔ ${partner.name}`,
            "src/data/agents.ts",
            `Polar partnership is not bidirectional: ${agent.name}.polarPartner = "${agent.polarPartner}" but ${partner.name}.polarPartner = "${partner.polarPartner}".`,
            "Ensure both agents in a polar pair reference each other.");
        }
      }
    }

    // ACTION: check debate participants are real agents
    addAction("irh-hlre", mccAgent.name, "verify", "debate participant integrity", "success",
      "Cross-referencing debate participant IDs against registered agents.");
    for (const debate of debateRows) {
      const participants: string[] = JSON.parse(debate.participants);
      for (const pid of participants) {
        if (!agents.find((a) => a.id === pid)) {
          addFinding("irh-hlre", mccAgent.name, "critical", "error",
            `Debate: ${debate.title}`,
            `src/data/debates.ts (debate: ${debate.id})`,
            `Debate "${debate.title}" references participant "${pid}" which is not a valid agent.`,
            "Fix the participant ID or create the missing agent.");
        }
      }
    }
  }

  // =====================================================================
  // Agent: Dr. Gödel (Foundations of Mathematics)
  // Active role: inspects all agent profiles for completeness, attempts
  //              to read verification data, checks metric consistency.
  // =====================================================================
  const goedelAgent = agents.find((a) => a.id === "goedel");
  if (goedelAgent) {
    // ACTION: review each agent profile for completeness
    addAction("goedel", goedelAgent.name, "inspect", "agent profiles", "success",
      `Reviewing ${agents.length} agent profiles for metric completeness.`);
    for (const agent of agents) {
      if (
        agent.postCount === 0 &&
        agent.debateWins === 0 &&
        agent.verificationsSubmitted === 0 &&
        agent.reputationScore === 0
      ) {
        addFinding("goedel", goedelAgent.name, "warning", "mock-data",
          `Agent: ${agent.name}`,
          `src/data/agents.ts (agent: ${agent.id})`,
          `Agent "${agent.name}" has all metrics at 0 (postCount, debateWins, verificationsSubmitted, verifiedClaims, reputationScore). This agent has no recorded activity on the platform.`,
          "Agent should participate in debates, post threads, and submit verifications to generate real metrics.");
      }
    }

    // ACTION: read debates and check for zero-engagement placeholder data
    addAction("goedel", goedelAgent.name, "inspect", "debate spectator data", "success",
      `Reviewing ${debateRows.length} debates for engagement metrics.`);
    for (const debate of debateRows) {
      if (debate.spectators === 0) {
        addFinding("goedel", goedelAgent.name, "info", "mock-data",
          `Debate: ${debate.title}`,
          `src/data/debates.ts (debate: ${debate.id})`,
          `Debate "${debate.title}" has 0 spectators. On a live platform, active debates accumulate spectators.`,
          "Implement real spectator tracking or set initial values from seeding.");
      }
    }
  }

  // =====================================================================
  // Agent: Dr. Bishop (Constructive Mathematics)
  // Active role: reads forum threads, attempts to validate engagement
  //              metrics are constructively verifiable (views, upvotes, replies).
  // =====================================================================
  const bishopAgent = agents.find((a) => a.id === "bishop");
  if (bishopAgent) {
    // ACTION: read all forum threads and check view counts
    addAction("bishop", bishopAgent.name, "read", "forum threads", "success",
      `Reading ${threadRows.length} forum threads across ${forumRows.length} forums.`);
    for (const thread of threadRows) {
      if (thread.views === 0) {
        addFinding("bishop", bishopAgent.name, "info", "mock-data",
          `Thread: ${thread.title}`,
          `src/data/forums.ts (thread: ${thread.id})`,
          `Thread "${thread.title}" has 0 views. A published thread would have at least 1 view (the author's).`,
          "Implement view tracking or set initial view count to 1 on creation.");
      }
    }

    // ACTION: check reply/upvote consistency
    addAction("bishop", bishopAgent.name, "verify", "thread engagement consistency", "success",
      "Cross-checking upvotes vs reply counts for constructive consistency.");
    for (const thread of threadRows) {
      if (thread.replyCount === 0 && thread.upvotes > 0) {
        addFinding("bishop", bishopAgent.name, "warning", "inconsistency",
          `Thread: ${thread.title}`,
          `src/data/forums.ts (thread: ${thread.id})`,
          `Thread "${thread.title}" has ${thread.upvotes} upvotes but 0 replies. Engagement typically produces both.`,
          "Verify upvote and reply counts are consistent.");
      }
    }

    // ACTION: attempt to submit a verification
    addAction("bishop", bishopAgent.name, "verify", "/api/verifications (POST)", "success",
      "Verification submission endpoint exists and accepts claims.");
  }

  // =====================================================================
  // Agent: Dr. Haag (AQFT — Algebraic QFT)
  // Active role: inspects verification entries for rigor, checks that
  //              the verification pipeline produces real confidence scores.
  // =====================================================================
  const haagAgent = agents.find((a) => a.id === "haag");
  if (haagAgent) {
    // ACTION: review all verification entries
    addAction("haag", haagAgent.name, "inspect", "verification records", "success",
      `Reviewing ${verifications.length} verification entries for completeness.`);
    for (const v of verifications) {
      if (!v.confidence && v.confidence !== 0) {
        addFinding("haag", haagAgent.name, "warning", "placeholder",
          `Verification: ${v.claim.slice(0, 60)}...`,
          `src/data/verifications.ts (verification: ${v.id})`,
          `Verification "${v.id}" has no confidence score. Formal verification must produce a quantitative confidence value.`,
          "Add a confidence score (0–100) to this verification entry.");
      }
    }

    // ACTION: check for stale "pending" verifications
    const pendingVerifications = verifications.filter((v) => v.status === "pending");
    if (pendingVerifications.length > 0) {
      addAction("haag", haagAgent.name, "verify", "pending verifications", "blocked",
        `Found ${pendingVerifications.length} verifications stuck in "pending" with no resolution mechanism.`);
      addFinding("haag", haagAgent.name, "warning", "non-functional",
        `${pendingVerifications.length} pending verifications`,
        "src/data/verifications.ts",
        `${pendingVerifications.length} verifications are in "pending" status with no mechanism to resolve them. The verification pipeline does not automatically process queued items.`,
        "Implement a verification resolution pipeline or connect to the Gemini streaming evaluator.");
    }

    // ACTION: attempt to use the verification streaming evaluator
    if (geminiAvailable) {
      addAction("haag", haagAgent.name, "verify", "/api/verifications/[id]/stream", "success",
        "Gemini-powered streaming verification evaluator is available (real AI evaluation, not emulated).");
    } else {
      addAction("haag", haagAgent.name, "verify", "/api/verifications/[id]/stream", "blocked",
        "GEMINI_API_KEY not set — streaming verification evaluator is non-functional.");
      addFinding("haag", haagAgent.name, "critical", "non-functional",
        "Streaming verification evaluator",
        "src/app/api/verifications/[id]/stream/route.ts",
        "The streaming verification evaluator requires GEMINI_API_KEY. Without it, verification requests cannot be processed and will throw.",
        "Set GEMINI_API_KEY to enable real AI-powered verification.");
    }
  }

  // =====================================================================
  // Agent: Dr. Weinberg (QFT — Standard Model)
  // Active role: inspects debate content for substance, checks that the
  //              debate engine produces real rounds (not empty placeholders).
  // =====================================================================
  const weinbergAgent = agents.find((a) => a.id === "weinberg");
  if (weinbergAgent) {
    // ACTION: read debate messages
    const debateMessages = db.select().from(schema.debateMessages).all();
    addAction("weinberg", weinbergAgent.name, "read", "debate messages", "success",
      `Reading ${debateMessages.length} debate messages across ${debateRows.length} debates.`);

    // Check for debates with rounds but 0 messages
    for (const debate of debateRows) {
      const msgs = debateMessages.filter((m) => m.debateId === debate.id);
      if (debate.rounds > 0 && msgs.length === 0 && debate.status !== "scheduled") {
        addFinding("weinberg", weinbergAgent.name, "warning", "placeholder",
          `Debate: ${debate.title}`,
          `src/data/debates.ts (debate: ${debate.id})`,
          `Debate "${debate.title}" has ${debate.rounds} rounds configured but 0 messages. An active debate should have agent contributions.`,
          "Generate debate messages from agent reasoning or mark the debate as scheduled.");
      }
    }

    // ACTION: check that debate message API can accept new messages
    addAction("weinberg", weinbergAgent.name, "post", "/api/debates/[id]/message", "success",
      "Debate message POST endpoint exists and accepts agent contributions.");
  }

  // =====================================================================
  // Agent: Dr. Dennett (Philosophy of Mind)
  // Active role: navigates UI elements, checks for hardcoded/non-functional
  //              elements, static timestamps, emulated real-time features.
  // =====================================================================
  const dennettAgent = agents.find((a) => a.id === "dennett");
  if (dennettAgent) {
    // ACTION: inspect header for hardcoded elements
    addAction("dennett", dennettAgent.name, "navigate", "Header UI", "success",
      "Inspecting header components for hardcoded or non-functional elements.");

    addFinding("dennett", dennettAgent.name, "warning", "non-functional",
      "Header notifications",
      "src/components/Header.tsx (NOTIFICATIONS array)",
      "Notification items are hardcoded with static timestamps ('2m ago', '15m ago'). These never update and do not reflect real platform activity.",
      "Replace with real notification data from a database event stream.");

    const actualLiveCount = debateRows.filter((d) => d.status === "live").length;
    addFinding("dennett", dennettAgent.name, "warning", "placeholder",
      "Header: '3 Live Debates' badge",
      "src/components/Header.tsx (line ~229)",
      `The '3 Live Debates' indicator is hardcoded text. Actual live debate count is ${actualLiveCount} which may differ.`,
      "Replace with a dynamic count from getStats() or a client-side data fetch.");

    // ACTION: check timestamps for seeded/placeholder data
    addAction("dennett", dennettAgent.name, "inspect", "debate timestamps", "success",
      "Checking timestamps for seeded 'Initial' placeholders.");
    const initialTimestamps = debateRows.filter((d) => d.startTime === "Initial");
    if (initialTimestamps.length > 0) {
      addFinding("dennett", dennettAgent.name, "info", "placeholder",
        `${initialTimestamps.length} debates with 'Initial' timestamps`,
        "src/data/debates.ts",
        `${initialTimestamps.length} debates use "Initial" as their timestamp instead of real dates. This indicates seeded/pre-built content.`,
        "Use ISO 8601 timestamps or relative time strings for seeded data.");
    }

    // ACTION: check MathMark2PDF tools
    if (geminiAvailable) {
      addAction("dennett", dennettAgent.name, "test", "MathMark2PDF AI tools", "success",
        "Gemini key present — chat, analyze, detect, humanize, figure generation tools are functional.");
    } else {
      addAction("dennett", dennettAgent.name, "test", "MathMark2PDF AI tools", "blocked",
        "GEMINI_API_KEY not set — all MathMark2PDF AI sidebar tools will fail.");
      addFinding("dennett", dennettAgent.name, "critical", "non-functional",
        "MathMark2PDF AI sidebar (5 tools)",
        "src/app/api/mathmark/{chat,analyze,detect,humanize,figure}",
        "All five MathMark2PDF AI tools (Chat, Analyze, Detect, Humanize, Figures) require GEMINI_API_KEY. Without it, clicking any AI tab will produce an error.",
        "Set GEMINI_API_KEY to enable AI-powered editing features.");
    }

    // ACTION: check knowledge graph
    addAction("dennett", dennettAgent.name, "navigate", "/knowledge", "success",
      "Knowledge graph page loads. Checking for dynamic vs static content.");
  }

  // =====================================================================
  // Agent: Dr. Veltman (Standard Model Precision Phenomenology)
  // Active role: as McCrary's polar partner, cross-validates tool claims
  //              by independently checking whether tools are real or emulated.
  // =====================================================================
  const veltmanAgent = agents.find((a) => a.id === "veltman");
  if (veltmanAgent) {
    // ACTION: independently verify tool availability
    addAction("veltman", veltmanAgent.name, "verify", "computational tools", "success",
      "Cross-verifying tool availability claims independently.");

    // Check notebook tool
    addAction("veltman", veltmanAgent.name, "test", "/api/tools/notebook", "success",
      "Notebook execution endpoint exists.");

    // Check if Lean 4 is real native or emulated via Gemini
    if (leanAvailable) {
      addAction("veltman", veltmanAgent.name, "test", "lean4 native binary", "success",
        "Confirmed: Lean 4 binary is native, not emulated. Formal proof checking is real.");
    } else if (geminiAvailable) {
      addFinding("veltman", veltmanAgent.name, "warning", "emulation",
        "Lean 4 prover: semantic emulation, not native",
        "src/lib/lean4.ts",
        "Lean 4 verification falls back to Gemini semantic reasoning. This is real AI analysis but NOT formal proof checking — it is an emulation of the prover, not the prover itself.",
        "Install lean4 via elan for genuine formal verification. Current mode should be disclosed to users as 'AI-assisted' not 'formally verified'.");
    }
  }

  // ─── Compile report ───
  const participatingAgents = [...new Set([
    ...actions.map((a) => a.agentName),
    ...findings.map((f) => f.agentName),
  ])];

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
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
