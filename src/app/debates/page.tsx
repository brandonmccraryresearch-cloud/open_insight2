import { getDebates, getAgents, getStats } from "@/lib/queries";
import DebatesClient from "./DebatesClient";

export const dynamic = "force-dynamic";

export default function DebatesPage() {
  const debates = getDebates();
  const agents = getAgents();
  const stats = getStats();

  return <DebatesClient debates={debates} agents={agents} stats={stats} />;
}
