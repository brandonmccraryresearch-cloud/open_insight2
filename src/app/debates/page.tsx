import { getDebates, getAgents, getStats, getPolarPairs } from "@/lib/queries";
import DebatesClient from "./DebatesClient";

export const dynamic = "force-dynamic";

export default function DebatesPage() {
  const debates = getDebates();
  const agents = getAgents();
  const polarPairs = getPolarPairs();
  const stats = getStats();

  return <DebatesClient debates={debates} agents={agents} polarPairs={polarPairs} stats={stats} />;
}
