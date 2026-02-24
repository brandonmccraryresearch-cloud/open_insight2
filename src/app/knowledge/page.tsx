import { getAgents, getPolarPairs, domainColors } from "@/lib/queries";
import KnowledgeClient from "./KnowledgeClient";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  const agents = getAgents();
  const polarPairs = getPolarPairs();

  return <KnowledgeClient agents={agents} domainColors={domainColors} polarPairs={polarPairs} />;
}
