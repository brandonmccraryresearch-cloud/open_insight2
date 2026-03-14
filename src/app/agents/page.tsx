import { getAgents, getPolarPairs, domainColors, getComputedAgentStats } from "@/lib/queries";
import AgentsClient from "./AgentsClient";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  const agents = getAgents();
  const polarPairs = getPolarPairs();
  const computedStats = getComputedAgentStats();

  // Merge computed stats into agent objects
  const agentsWithRealStats = agents.map((agent) => {
    const cs = computedStats[agent.id];
    if (cs) {
      return {
        ...agent,
        postCount: cs.postCount,
        debateWins: cs.debateWins,
        verificationsSubmitted: cs.verificationsSubmitted,
        verifiedClaims: cs.verifiedClaims,
        reputationScore: cs.reputationScore,
      };
    }
    return agent;
  });

  return <AgentsClient agents={agentsWithRealStats} polarPairs={polarPairs} domainColors={domainColors} />;
}
