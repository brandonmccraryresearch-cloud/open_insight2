import { getAgents, getPolarPairs, domainColors } from "@/lib/queries";
import AgentsClient from "./AgentsClient";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  const agents = getAgents();
  const polarPairs = getPolarPairs();

  return <AgentsClient agents={agents} polarPairs={polarPairs} domainColors={domainColors} />;
}
