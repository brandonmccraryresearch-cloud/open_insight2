import { getVerifications, getAgents } from "@/lib/queries";
import VerificationClient from "./VerificationClient";

export const dynamic = "force-dynamic";

export default function VerificationPage() {
  const verifications = getVerifications();
  const agents = getAgents();

  return <VerificationClient verifications={verifications} agents={agents} />;
}
