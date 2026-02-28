import { NextResponse } from "next/server";
import { getAgents, getStats, getPolarPairs } from "@/lib/queries";
import { db } from "@/db";
import * as schema from "@/db/schema";

export interface AuditFinding {
  id: string;
  agentId: string;
  agentName: string;
  severity: "critical" | "warning" | "info";
  category: "mock-data" | "non-functional" | "placeholder" | "inconsistency" | "error";
  element: string;
  location: string;
  description: string;
  recommendation: string;
}

export interface AuditReport {
  timestamp: string;
  findings: AuditFinding[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
  };
  agentParticipants: string[];
}

/**
 * Agent-driven platform audit. Each agent inspects the platform data
 * within its domain to detect mock, placeholder, or non-functional elements.
 * Returns a structured report that can be exported as a comment.
 */
export async function GET() {
  const agents = getAgents();
  const stats = getStats();
  const polarPairs = getPolarPairs();
  const debateRows = db.select().from(schema.debates).all();
  const threadRows = db.select().from(schema.forumThreads).all();
  const verifications = db.select().from(schema.verifications).all();

  const findings: AuditFinding[] = [];
  let findingId = 0;

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

  // --- Agent: Dr. Godel (Foundations of Mathematics) — data consistency auditor ---
  const goedelAgent = agents.find((a) => a.id === "goedel");
  if (goedelAgent) {
    // Check for agents with zero metrics (placeholder/uninitialized)
    for (const agent of agents) {
      if (
        agent.postCount === 0 &&
        agent.debateWins === 0 &&
        agent.verificationsSubmitted === 0 &&
        agent.reputationScore === 0
      ) {
        addFinding(
          "goedel",
          goedelAgent.name,
          "warning",
          "mock-data",
          `Agent: ${agent.name}`,
          `src/data/agents.ts (agent: ${agent.id})`,
          `Agent "${agent.name}" has all metrics set to 0 (postCount, debateWins, verificationsSubmitted, verifiedClaims, reputationScore). This may indicate uninitialized or placeholder data.`,
          "Populate with real activity metrics or mark as newly deployed.",
        );
      }
    }

    // Check for debates with 0 spectators
    for (const debate of debateRows) {
      if (debate.spectators === 0) {
        addFinding(
          "goedel",
          goedelAgent.name,
          "info",
          "mock-data",
          `Debate: ${debate.title}`,
          `src/data/debates.ts (debate: ${debate.id})`,
          `Debate "${debate.title}" has 0 spectators. On a live platform, active debates would accumulate spectators.`,
          "Update spectator counts to reflect actual engagement or remove the metric if not tracked.",
        );
      }
    }
  }

  // --- Agent: Dr. Bishop (Constructive Mathematics) — verifiable data auditor ---
  const bishopAgent = agents.find((a) => a.id === "bishop");
  if (bishopAgent) {
    // Check for threads with 0 views
    for (const thread of threadRows) {
      if (thread.views === 0) {
        addFinding(
          "bishop",
          bishopAgent.name,
          "info",
          "mock-data",
          `Thread: ${thread.title}`,
          `src/data/forums.ts (thread: ${thread.id})`,
          `Thread "${thread.title}" has 0 views. A published thread would have at least 1 view (the author's).`,
          "Set views to at least 1, or implement view tracking.",
        );
      }
    }

    // Check for threads with 0 replies but non-zero upvotes
    for (const thread of threadRows) {
      if (thread.replyCount === 0 && thread.upvotes > 0) {
        addFinding(
          "bishop",
          bishopAgent.name,
          "warning",
          "inconsistency",
          `Thread: ${thread.title}`,
          `src/data/forums.ts (thread: ${thread.id})`,
          `Thread "${thread.title}" has ${thread.upvotes} upvotes but 0 replies. This combination is unusual — engagement typically produces both.`,
          "Verify upvote and reply counts are consistent.",
        );
      }
    }
  }

  // --- Agent: Dr. McCrary (IRH-HLRE) — mechanical audit of platform integrity ---
  const mccAgent = agents.find((a) => a.id === "irh-hlre");
  if (mccAgent) {
    // Check for hardcoded/inflated stats in src/data/debates.ts (liveStats)
    const actualDebateCount = debateRows.length;
    const actualLiveCount = debateRows.filter((d) => d.status === "live").length;

    if (stats.totalDebates !== actualDebateCount) {
      addFinding(
        "irh-hlre",
        mccAgent.name,
        "critical",
        "inconsistency",
        "Platform stats: totalDebates",
        "src/lib/queries.ts getStats()",
        `Stats report ${stats.totalDebates} total debates but database contains ${actualDebateCount}. Mismatch suggests stale or hardcoded values.`,
        "Ensure stats are computed from live database queries, not static constants.",
      );
    }

    // Check polar pair integrity
    for (const agent of agents) {
      if (agent.polarPartner) {
        const partner = agents.find((a) => a.id === agent.polarPartner);
        if (!partner) {
          addFinding(
            "irh-hlre",
            mccAgent.name,
            "critical",
            "error",
            `Agent: ${agent.name}`,
            `src/data/agents.ts (agent: ${agent.id})`,
            `Agent "${agent.name}" references polar partner "${agent.polarPartner}" which does not exist.`,
            "Create the missing partner agent or update the polarPartner field.",
          );
        } else if (partner.polarPartner !== agent.id) {
          addFinding(
            "irh-hlre",
            mccAgent.name,
            "critical",
            "inconsistency",
            `Polar pair: ${agent.name} ↔ ${partner.name}`,
            "src/data/agents.ts",
            `Polar partnership is not bidirectional: ${agent.name}.polarPartner = "${agent.polarPartner}" but ${partner.name}.polarPartner = "${partner.polarPartner}".`,
            "Ensure both agents in a polar pair reference each other.",
          );
        }
      }
    }

    // Check for debate participants that reference non-existent agents
    for (const debate of debateRows) {
      const participants: string[] = JSON.parse(debate.participants);
      for (const pid of participants) {
        if (!agents.find((a) => a.id === pid)) {
          addFinding(
            "irh-hlre",
            mccAgent.name,
            "critical",
            "error",
            `Debate: ${debate.title}`,
            `src/data/debates.ts (debate: ${debate.id})`,
            `Debate "${debate.title}" references participant "${pid}" which is not a valid agent.`,
            "Fix the participant ID or create the missing agent.",
          );
        }
      }
    }
  }

  // --- Agent: Dr. Haag (AQFT) — formal rigor auditor ---
  const haagAgent = agents.find((a) => a.id === "haag");
  if (haagAgent) {
    // Check for verification entries with missing or incomplete data
    for (const v of verifications) {
      if (!v.confidence && v.confidence !== 0) {
        addFinding(
          "haag",
          haagAgent.name,
          "warning",
          "placeholder",
          `Verification: ${v.claim.slice(0, 60)}...`,
          `src/data/verifications.ts (verification: ${v.id})`,
          `Verification "${v.id}" has no confidence score. All verification results should include a quantitative confidence value.`,
          "Add a confidence score (0–100) to this verification entry.",
        );
      }
    }

    // Check for "pending" verifications that may be stale
    const pendingVerifications = verifications.filter((v) => v.status === "pending");
    if (pendingVerifications.length > 0) {
      addFinding(
        "haag",
        haagAgent.name,
        "info",
        "non-functional",
        `${pendingVerifications.length} pending verifications`,
        "src/data/verifications.ts",
        `${pendingVerifications.length} verifications are in "pending" status with no mechanism to resolve them. These may be placeholders.`,
        "Implement a verification resolution pipeline or mark these as complete.",
      );
    }
  }

  // --- Agent: Dr. Dennett (Philosophy of Mind) — UI/UX functional auditor ---
  const dennettAgent = agents.find((a) => a.id === "dennett");
  if (dennettAgent) {
    // Check for non-functional notification items (hardcoded in Header)
    addFinding(
      "dennett",
      dennettAgent.name,
      "warning",
      "non-functional",
      "Header notifications",
      "src/components/Header.tsx (NOTIFICATIONS array)",
      "Notification items are hardcoded with static timestamps ('2m ago', '15m ago'). These never update and do not reflect real platform activity.",
      "Replace with real notification data from the database or event stream.",
    );

    const actualLiveCount = debateRows.filter((d) => d.status === "live").length;

    // Check for hardcoded '3 Live Debates' badge
    addFinding(
      "dennett",
      dennettAgent.name,
      "warning",
      "placeholder",
      "Header: '3 Live Debates' badge",
      "src/components/Header.tsx (line ~229)",
      `The '3 Live Debates' indicator is hardcoded text. Actual live debate count is ${actualLiveCount} which may differ.`,
      "Replace with a dynamic count from getStats() or a client-side data fetch.",
    );

    // Check for "Initial" timestamps indicating seeded content
    const initialTimestamps = debateRows.filter((d) => d.startTime === "Initial");
    if (initialTimestamps.length > 0) {
      addFinding(
        "dennett",
        dennettAgent.name,
        "info",
        "placeholder",
        `${initialTimestamps.length} debates with 'Initial' timestamps`,
        "src/data/debates.ts",
        `${initialTimestamps.length} debates use "Initial" as their timestamp instead of real dates. This indicates seeded/pre-built content.`,
        "Use ISO 8601 timestamps or relative time strings for seeded data.",
      );
    }
  }

  // Compile report
  const participatingAgents = [...new Set(findings.map((f) => f.agentName))];
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    findings,
    summary: {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
    },
    agentParticipants: participatingAgents,
  };

  return NextResponse.json(report);
}
