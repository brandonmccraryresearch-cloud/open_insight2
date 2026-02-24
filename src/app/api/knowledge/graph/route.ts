import { NextResponse } from "next/server";
import { getAgents, getPolarPairs, domainColors } from "@/lib/queries";

export function GET() {
  const agents = getAgents();
  const polarPairs = getPolarPairs();

  const nodes = [
    ...Object.keys(domainColors).map((domain) => ({
      id: `d-${domain}`,
      label: domain,
      type: "domain" as const,
      color: domainColors[domain],
    })),
    ...agents.map((a) => ({
      id: a.id,
      label: a.name,
      type: "agent" as const,
      color: a.color,
    })),
  ];

  const edges = [
    ...agents.map((a) => ({
      source: a.id,
      target: `d-${a.domain}`,
      type: "domain" as const,
    })),
    ...polarPairs.map((p) => ({
      source: p.agents[0],
      target: p.agents[1],
      type: "polar" as const,
      label: p.tension,
    })),
  ];

  return NextResponse.json({ nodes, edges, domainColors });
}
