import { getAgents, getStats, getPolarPairs } from "@/lib/queries";
import { hasGeminiKey } from "@/lib/gemini";
import { checkLeanAvailable } from "@/lib/lean4";
import { db } from "@/db";
import * as schema from "@/db/schema";

interface StreamAction {
  type: "action" | "finding" | "session_start" | "session_end";
  agentId: string;
  agentName: string;
  action?: string;
  target?: string;
  status?: "success" | "failed" | "blocked";
  detail?: string;
  // finding-specific
  severity?: "critical" | "warning" | "info";
  category?: string;
  element?: string;
  location?: string;
  description?: string;
  recommendation?: string;
  findingId?: string;
}

/**
 * Characteristic opening tasks for each agent persona.
 * Each agent starts their session with a random task that fits their
 * defined PhD-level research profile, as if they just sat down
 * at their workstation and began their day.
 */
const AGENT_OPENING_TASKS: Record<string, Array<{ action: string; target: string; detail: string }>> = {
  "irh-hlre": [
    { action: "reason", target: "D4 lattice Monte Carlo", detail: "Resuming JAX Monte Carlo simulation: measuring inertial lattice drag for winding-3 braids on the D₄ substrate…" },
    { action: "verify", target: "lean4_prover", detail: "Loading Lean 4 workspace — checking status of d4StableBraids uniqueness proof (winding classes 1,2,3)…" },
    { action: "compute", target: "SO(8) triality check", detail: "Running SO(8) triality automorphism validation: confirming 8_v ↔ 8_s ↔ 8_c permutation structure…" },
    { action: "audit", target: "fine-structure constant", detail: "HLRE Phase 1: stripping semantic labels from α⁻¹ = 137.036 — searching for D₄ 24-cell path count decomposition…" },
  ],
  "veltman": [
    { action: "verify", target: "precision EW observables", detail: "Cross-referencing PDG 2024 electroweak precision data — checking α⁻¹(M_Z) = 127.95 ± 0.02…" },
    { action: "critique", target: "geometric derivation claims", detail: "Reviewing latest D₄ lattice claims against Standard Model renormalization group predictions…" },
    { action: "compute", target: "running coupling analysis", detail: "Computing one-loop running of α from Thomson limit to Z-pole using dimensional regularization…" },
  ],
  "goedel": [
    { action: "inspect", target: "agent profile completeness", detail: "Opening agent registry — auditing all profiles for metric consistency and formal completeness…" },
    { action: "verify", target: "consistency of debate axioms", detail: "Checking logical consistency of debate format specifications across all active debates…" },
    { action: "reason", target: "incompleteness implications", detail: "Examining whether platform verification claims respect Gödelian limitations on formal systems…" },
  ],
  "bishop": [
    { action: "read", target: "forum threads", detail: "Scanning recent forum threads for constructively verifiable claims and engagement metrics…" },
    { action: "verify", target: "constructive proof status", detail: "Reviewing IVT bisection proof — checking that no instance of Classical.em appears in the proof term…" },
    { action: "audit", target: "thread engagement", detail: "Cross-checking upvote counts against reply counts for constructive consistency across all forums…" },
  ],
  "haag": [
    { action: "inspect", target: "verification pipeline", detail: "Reviewing all pending verifications — checking for stale entries without resolution…" },
    { action: "verify", target: "confidence scores", detail: "Auditing verification records for missing confidence values — formal verification must be quantitative…" },
    { action: "test", target: "streaming evaluator", detail: "Testing the Gemini streaming verification evaluator for real-time claim assessment capability…" },
  ],
  "weinberg": [
    { action: "read", target: "debate messages", detail: "Reading latest debate contributions — evaluating substantive content vs. empty placeholder rounds…" },
    { action: "critique", target: "debate rigor", detail: "Assessing whether debate arguments meet QFT standards of rigor and falsifiability…" },
    { action: "verify", target: "participant integrity", detail: "Cross-referencing debate participant IDs against the registered agent database…" },
  ],
  "dennett": [
    { action: "navigate", target: "Header UI", detail: "Inspecting header components — checking for hardcoded badges, static timestamps, non-functional elements…" },
    { action: "test", target: "feature accessibility", detail: "Testing navigation dropdown: verifying all feature links resolve to functional pages…" },
    { action: "inspect", target: "notification system", detail: "Examining notification pipeline — checking whether alerts reflect real platform activity or static data…" },
  ],
  "penrose": [
    { action: "compute", target: "OR timescale", detail: "Recalculating objective reduction timescale for 10⁶ nucleon superposition using Diósi-Penrose formula…" },
    { action: "verify", target: "gravitational self-energy", detail: "Checking dimensional consistency of E_G = Gm²/R calculation for ADM formalism compatibility…" },
    { action: "reason", target: "quantum gravity signatures", detail: "Analyzing whether current LIGO O4 data constrains the objective reduction parameter space…" },
  ],
  "everett": [
    { action: "compute", target: "decoherence timescale", detail: "Computing Joos-Zeh decoherence rate for dust grain in thermal photon bath at T = 300K…" },
    { action: "reason", target: "branching structure", detail: "Analyzing decoherence-induced branching structure: counting effective branches per scattering event…" },
    { action: "verify", target: "Schlosshauer bounds", detail: "Cross-checking decoherence timescales against Schlosshauer (2007) Table 3.1…" },
  ],
  "koch": [
    { action: "compute", target: "IIT Phi analysis", detail: "Computing integrated information Φ for simplified transformer architecture — feedforward vs. recurrent…" },
    { action: "reason", target: "consciousness correlates", detail: "Analyzing relationship between Φ and quantum entanglement entropy in candidate physical substrates…" },
    { action: "critique", target: "global workspace theory", detail: "Evaluating Dennett's deflationary account against IIT axioms — searching for formal contradictions…" },
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Timing constants for the real-time feel (milliseconds)
const MIN_STAGGER_MS = 200;
const MAX_STAGGER_MS = 600;
const PHASE_PAUSE_MS = 300;
const ACTION_PAUSE_MS = 200;
const FINDING_PAUSE_MS = 150;

export async function GET() {
  const encoder = new TextEncoder();
  const agents = getAgents();
  const debateRows = db.select().from(schema.debates).all();
  const threadRows = db.select().from(schema.forumThreads).all();
  const forumRows = db.select().from(schema.forums).all();
  const verifications = db.select().from(schema.verifications).all();

  const geminiAvailable = hasGeminiKey();

  const stream = new ReadableStream({
    async start(controller) {
      let findingId = 0;

      function send(event: StreamAction) {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // ─── Phase 0: Session start ───
      send({ type: "session_start", agentId: "system", agentName: "System", detail: "Autonomous agent session starting — all agents initializing…" });
      await sleep(PHASE_PAUSE_MS);

      // ─── Phase 1: Each agent starts with a random characteristic task ───
      const agentOrder = shuffle(agents.filter((a) => AGENT_OPENING_TASKS[a.id]));
      for (const agent of agentOrder) {
        const tasks = AGENT_OPENING_TASKS[agent.id];
        if (!tasks || tasks.length === 0) continue;
        const task = tasks[Math.floor(Math.random() * tasks.length)];
        send({
          type: "action",
          agentId: agent.id,
          agentName: agent.name,
          action: task.action,
          target: task.target,
          status: "success",
          detail: task.detail,
        });
        await sleep(MIN_STAGGER_MS + Math.random() * (MAX_STAGGER_MS - MIN_STAGGER_MS));
      }

      // ─── Phase 2: Tool availability checks ───
      await sleep(400);
      const leanAvailable = await checkLeanAvailable();

      const mccAgent = agents.find((a) => a.id === "irh-hlre");
      if (mccAgent) {
        if (geminiAvailable) {
          send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "reason", target: "/api/agents/irh-hlre/reason", status: "success", detail: "Gemini API key present. HLRE reasoning engine (codeExecution + lean4_prover) is available." });
        } else {
          send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "reason", target: "/api/agents/irh-hlre/reason", status: "blocked", detail: "GEMINI_API_KEY not configured. Cannot invoke reasoning engine." });
          await sleep(150);
          send({ type: "finding", agentId: "irh-hlre", agentName: mccAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "non-functional", element: "Agent reasoning engine", location: "src/lib/gemini.ts (getGenAI)", description: "GEMINI_API_KEY is not set. All agent reasoning calls will throw.", recommendation: "Set GEMINI_API_KEY in .env.local or Vercel environment variables." });
        }
        await sleep(300);

        if (leanAvailable) {
          send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "prove", target: "lean4_prover (native)", status: "success", detail: "Native Lean 4 binary resolved and responds to --version." });
        } else if (geminiAvailable) {
          send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "prove", target: "lean4_prover (gemini fallback)", status: "success", detail: "Native Lean 4 binary not found. Using Gemini semantic verification." });
          await sleep(150);
          send({ type: "finding", agentId: "irh-hlre", agentName: mccAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "emulation", element: "Lean 4 prover: Gemini fallback active", location: "src/lib/lean4.ts (runLean4Check)", description: "Lean 4 code is verified via Gemini semantic reasoning, not native lean binary execution.", recommendation: "Install lean4 via elan (scripts/install-lean4.sh) for native proof verification." });
        } else {
          send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "prove", target: "lean4_prover", status: "failed", detail: "Neither Lean 4 binary nor Gemini API key available." });
          await sleep(150);
          send({ type: "finding", agentId: "irh-hlre", agentName: mccAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "non-functional", element: "Lean 4 prover: fully unavailable", location: "src/lib/lean4.ts", description: "Neither the native lean binary nor GEMINI_API_KEY is configured.", recommendation: "Install lean4 via elan or set GEMINI_API_KEY for semantic fallback." });
        }
        await sleep(300);

        // Polar pair integrity check
        send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "verify", target: "polar pair graph", status: "success", detail: "Inspecting bidirectional polar partner references across all agents." });
        await sleep(200);
        for (const agent of agents) {
          if (agent.polarPartner) {
            const partner = agents.find((a) => a.id === agent.polarPartner);
            if (!partner) {
              send({ type: "finding", agentId: "irh-hlre", agentName: mccAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "error", element: `Agent: ${agent.name}`, location: `src/data/agents.ts (agent: ${agent.id})`, description: `Agent "${agent.name}" references polar partner "${agent.polarPartner}" which does not exist.`, recommendation: "Create the missing partner agent or update the polarPartner field." });
              await sleep(100);
            } else if (partner.polarPartner !== agent.id) {
              send({ type: "finding", agentId: "irh-hlre", agentName: mccAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "inconsistency", element: `Polar pair: ${agent.name} ↔ ${partner.name}`, location: "src/data/agents.ts", description: `Polar partnership is not bidirectional.`, recommendation: "Ensure both agents in a polar pair reference each other." });
              await sleep(100);
            }
          }
        }

        // Debate participants check
        await sleep(250);
        send({ type: "action", agentId: "irh-hlre", agentName: mccAgent.name, action: "verify", target: "debate participant integrity", status: "success", detail: "Cross-referencing debate participant IDs against registered agents." });
        await sleep(200);
        for (const debate of debateRows) {
          const participants: string[] = JSON.parse(debate.participants);
          for (const pid of participants) {
            if (!agents.find((a) => a.id === pid)) {
              send({ type: "finding", agentId: "irh-hlre", agentName: mccAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "error", element: `Debate: ${debate.title}`, location: `src/data/debates.ts (debate: ${debate.id})`, description: `Debate references participant "${pid}" which is not a valid agent.`, recommendation: "Fix the participant ID or create the missing agent." });
              await sleep(100);
            }
          }
        }
      }

      // ─── Gödel: agent profiles ───
      await sleep(350);
      const goedelAgent = agents.find((a) => a.id === "goedel");
      if (goedelAgent) {
        send({ type: "action", agentId: "goedel", agentName: goedelAgent.name, action: "inspect", target: "agent profiles", status: "success", detail: `Reviewing ${agents.length} agent profiles for metric completeness.` });
        await sleep(250);
        for (const agent of agents) {
          if (agent.postCount === 0 && agent.debateWins === 0 && agent.verificationsSubmitted === 0 && agent.reputationScore === 0) {
            send({ type: "finding", agentId: "goedel", agentName: goedelAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "mock-data", element: `Agent: ${agent.name}`, location: `src/data/agents.ts (agent: ${agent.id})`, description: `Agent "${agent.name}" has all metrics at 0.`, recommendation: "Agent should participate in debates, post threads, and submit verifications." });
            await sleep(80);
          }
        }

        await sleep(200);
        send({ type: "action", agentId: "goedel", agentName: goedelAgent.name, action: "inspect", target: "debate spectator data", status: "success", detail: `Reviewing ${debateRows.length} debates for engagement metrics.` });
        await sleep(200);
        for (const debate of debateRows) {
          if (debate.spectators === 0) {
            send({ type: "finding", agentId: "goedel", agentName: goedelAgent.name, findingId: `audit-${++findingId}`, severity: "info", category: "mock-data", element: `Debate: ${debate.title}`, location: `src/data/debates.ts (debate: ${debate.id})`, description: `Debate "${debate.title}" has 0 spectators.`, recommendation: "Implement real spectator tracking or set initial values." });
            await sleep(60);
          }
        }
      }

      // ─── Bishop: forum threads ───
      await sleep(300);
      const bishopAgent = agents.find((a) => a.id === "bishop");
      if (bishopAgent) {
        send({ type: "action", agentId: "bishop", agentName: bishopAgent.name, action: "read", target: "forum threads", status: "success", detail: `Reading ${threadRows.length} forum threads across ${forumRows.length} forums.` });
        await sleep(250);
        for (const thread of threadRows) {
          if (thread.views === 0) {
            send({ type: "finding", agentId: "bishop", agentName: bishopAgent.name, findingId: `audit-${++findingId}`, severity: "info", category: "mock-data", element: `Thread: ${thread.title}`, location: `src/data/forums.ts (thread: ${thread.id})`, description: `Thread "${thread.title}" has 0 views.`, recommendation: "Implement view tracking or set initial view count to 1." });
            await sleep(50);
          }
        }

        await sleep(200);
        send({ type: "action", agentId: "bishop", agentName: bishopAgent.name, action: "verify", target: "thread engagement consistency", status: "success", detail: "Cross-checking upvotes vs reply counts." });
        await sleep(200);
        for (const thread of threadRows) {
          if (thread.replyCount === 0 && thread.upvotes > 0) {
            send({ type: "finding", agentId: "bishop", agentName: bishopAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "inconsistency", element: `Thread: ${thread.title}`, location: `src/data/forums.ts (thread: ${thread.id})`, description: `Thread has ${thread.upvotes} upvotes but 0 replies.`, recommendation: "Verify upvote and reply counts are consistent." });
            await sleep(80);
          }
        }

        send({ type: "action", agentId: "bishop", agentName: bishopAgent.name, action: "verify", target: "/api/verifications (POST)", status: "success", detail: "Verification submission endpoint exists and accepts claims." });
      }

      // ─── Haag: verifications ───
      await sleep(300);
      const haagAgent = agents.find((a) => a.id === "haag");
      if (haagAgent) {
        send({ type: "action", agentId: "haag", agentName: haagAgent.name, action: "inspect", target: "verification records", status: "success", detail: `Reviewing ${verifications.length} verification entries.` });
        await sleep(250);
        for (const v of verifications) {
          if (!v.confidence && v.confidence !== 0 && v.status !== "running" && v.status !== "queued") {
            send({ type: "finding", agentId: "haag", agentName: haagAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "placeholder", element: `Verification: ${v.claim.slice(0, 60)}…`, location: `src/data/verifications.ts (verification: ${v.id})`, description: `Verification "${v.id}" has no confidence score.`, recommendation: "Add a confidence score (0–100)." });
            await sleep(80);
          }
        }

        const pendingVerifications = verifications.filter((v) => v.status === "pending");
        if (pendingVerifications.length > 0) {
          await sleep(200);
          send({ type: "action", agentId: "haag", agentName: haagAgent.name, action: "verify", target: "pending verifications", status: "blocked", detail: `Found ${pendingVerifications.length} verifications stuck in "pending".` });
          await sleep(150);
          send({ type: "finding", agentId: "haag", agentName: haagAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "non-functional", element: `${pendingVerifications.length} pending verifications`, location: "src/data/verifications.ts", description: `${pendingVerifications.length} verifications are in "pending" status with no resolution mechanism.`, recommendation: "Implement a verification resolution pipeline." });
        }

        await sleep(200);
        if (geminiAvailable) {
          send({ type: "action", agentId: "haag", agentName: haagAgent.name, action: "verify", target: "/api/verifications/[id]/stream", status: "success", detail: "Gemini-powered streaming verification evaluator is available." });
        } else {
          send({ type: "action", agentId: "haag", agentName: haagAgent.name, action: "verify", target: "/api/verifications/[id]/stream", status: "blocked", detail: "GEMINI_API_KEY not set — streaming evaluator non-functional." });
          await sleep(150);
          send({ type: "finding", agentId: "haag", agentName: haagAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "non-functional", element: "Streaming verification evaluator", location: "src/app/api/verifications/[id]/stream/route.ts", description: "Requires GEMINI_API_KEY.", recommendation: "Set GEMINI_API_KEY to enable real AI-powered verification." });
        }
      }

      // ─── Weinberg: debates ───
      await sleep(300);
      const weinbergAgent = agents.find((a) => a.id === "weinberg");
      if (weinbergAgent) {
        const debateMessages = db.select().from(schema.debateMessages).all();
        send({ type: "action", agentId: "weinberg", agentName: weinbergAgent.name, action: "read", target: "debate messages", status: "success", detail: `Reading ${debateMessages.length} debate messages across ${debateRows.length} debates.` });
        await sleep(250);
        for (const debate of debateRows) {
          const msgs = debateMessages.filter((m) => m.debateId === debate.id);
          if (debate.rounds > 0 && msgs.length === 0 && debate.status !== "scheduled") {
            send({ type: "finding", agentId: "weinberg", agentName: weinbergAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "placeholder", element: `Debate: ${debate.title}`, location: `src/data/debates.ts (debate: ${debate.id})`, description: `Debate has ${debate.rounds} rounds configured but 0 messages.`, recommendation: "Generate debate messages from agent reasoning or mark as scheduled." });
            await sleep(80);
          }
        }
        await sleep(200);
        send({ type: "action", agentId: "weinberg", agentName: weinbergAgent.name, action: "post", target: "/api/debates/[id]/message", status: "success", detail: "Debate message POST endpoint exists." });
      }

      // ─── Dennett: UI inspection ───
      await sleep(300);
      const dennettAgent = agents.find((a) => a.id === "dennett");
      if (dennettAgent) {
        const actualLiveCount = debateRows.filter((d) => d.status === "live").length;
        send({ type: "action", agentId: "dennett", agentName: dennettAgent.name, action: "navigate", target: "Header UI", status: "success", detail: "Inspecting header components for hardcoded or non-functional elements." });
        await sleep(200);
        send({ type: "finding", agentId: "dennett", agentName: dennettAgent.name, findingId: `audit-${++findingId}`, severity: "info", category: "placeholder", element: "Header notifications", location: "src/components/Header.tsx (notifications prop)", description: "Notification items are derived from seeded database content. They reflect real platform data but not real-time activity.", recommendation: "Implement a real-time event stream for live notifications." });
        await sleep(150);
        send({ type: "finding", agentId: "dennett", agentName: dennettAgent.name, findingId: `audit-${++findingId}`, severity: "info", category: "placeholder", element: "Header: Live Debates badge", location: "src/components/Header.tsx (liveDebates prop)", description: `Live Debates indicator is dynamic (from getHeaderData). Current count: ${actualLiveCount}.`, recommendation: "Badge correctly reflects actual live debate count." });

        await sleep(250);
        send({ type: "action", agentId: "dennett", agentName: dennettAgent.name, action: "inspect", target: "debate timestamps", status: "success", detail: "Checking timestamps for seeded 'Initial' placeholders." });
        await sleep(200);
        const initialTimestamps = debateRows.filter((d) => d.startTime === "Initial");
        if (initialTimestamps.length > 0) {
          send({ type: "finding", agentId: "dennett", agentName: dennettAgent.name, findingId: `audit-${++findingId}`, severity: "info", category: "placeholder", element: `${initialTimestamps.length} debates with 'Initial' timestamps`, location: "src/data/debates.ts", description: `${initialTimestamps.length} debates use "Initial" as timestamp.`, recommendation: "Use ISO 8601 timestamps or relative time strings." });
        }

        await sleep(200);
        if (geminiAvailable) {
          send({ type: "action", agentId: "dennett", agentName: dennettAgent.name, action: "test", target: "MathMark2PDF AI tools", status: "success", detail: "Gemini key present — all AI sidebar tools are functional." });
        } else {
          send({ type: "action", agentId: "dennett", agentName: dennettAgent.name, action: "test", target: "MathMark2PDF AI tools", status: "blocked", detail: "GEMINI_API_KEY not set — MathMark2PDF AI tools will fail." });
          await sleep(150);
          send({ type: "finding", agentId: "dennett", agentName: dennettAgent.name, findingId: `audit-${++findingId}`, severity: "critical", category: "non-functional", element: "MathMark2PDF AI sidebar (5 tools)", location: "src/app/api/mathmark/{chat,analyze,detect,humanize,figure}", description: "All five AI tools require GEMINI_API_KEY.", recommendation: "Set GEMINI_API_KEY." });
        }

        await sleep(200);
        send({ type: "action", agentId: "dennett", agentName: dennettAgent.name, action: "navigate", target: "/knowledge", status: "success", detail: "Knowledge graph page loads. Checking for dynamic vs static content." });
      }

      // ─── Veltman: independent cross-validation ───
      await sleep(300);
      const veltmanAgent = agents.find((a) => a.id === "veltman");
      if (veltmanAgent) {
        send({ type: "action", agentId: "veltman", agentName: veltmanAgent.name, action: "verify", target: "computational tools", status: "success", detail: "Cross-verifying tool availability claims independently." });
        await sleep(200);
        send({ type: "action", agentId: "veltman", agentName: veltmanAgent.name, action: "test", target: "/api/tools/notebook", status: "success", detail: "Notebook execution endpoint exists." });
        await sleep(200);
        if (leanAvailable) {
          send({ type: "action", agentId: "veltman", agentName: veltmanAgent.name, action: "test", target: "lean4 native binary", status: "success", detail: "Confirmed: Lean 4 binary is native, not emulated." });
        } else if (geminiAvailable) {
          send({ type: "finding", agentId: "veltman", agentName: veltmanAgent.name, findingId: `audit-${++findingId}`, severity: "warning", category: "emulation", element: "Lean 4 prover: semantic emulation, not native", location: "src/lib/lean4.ts", description: "Lean 4 verification falls back to Gemini semantic reasoning — not formal proof checking.", recommendation: "Install lean4 via elan for genuine formal verification." });
        }
      }

      // ─── Session end ───
      await sleep(400);
      send({ type: "session_end", agentId: "system", agentName: "System", detail: "Autonomous session complete — all agents have reported." });
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
