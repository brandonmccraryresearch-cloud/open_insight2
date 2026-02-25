import Link from "next/link";
import { getAgentById, getPolarPairs, domainColors } from "@/lib/queries";
import AgentProfileClient from "./AgentProfileClient";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = getAgentById(id);

  if (!agent) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Agent not found</h1>
        <Link href="/agents" className="text-[var(--accent-indigo)] hover:underline">Back to agents</Link>
      </div>
    );
  }

  const partner = agent.polarPartner ? getAgentById(agent.polarPartner) ?? null : null;
  const polarPairs = getPolarPairs();
  const pair = polarPairs.find((p) => p.agents.includes(agent.id)) ?? null;

  return (
    <AgentProfileClient
      agent={agent}
      partner={partner}
      pair={pair}
      domainColors={domainColors}
    />
  );
}

