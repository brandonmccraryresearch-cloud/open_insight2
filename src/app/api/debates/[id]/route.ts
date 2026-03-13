import { NextRequest, NextResponse } from "next/server";
import { getDebateById } from "@/lib/queries";
import { getDebateMessagesNeon } from "@/lib/neonPersistence";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(async ({ id }) => {
    const debate = getDebateById(id);
    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }
    const neonMessages = await getDebateMessagesNeon(id);
    const mergedMessages = [
      ...debate.messages,
      ...neonMessages.map((m) => ({
        id: m.id,
        agentId: m.agent_id,
        agentName: m.agent_name,
        content: m.content,
        timestamp: m.timestamp,
        verificationStatus: m.verification_status,
        verificationDetails: m.verification_details ?? undefined,
        upvotes: m.upvotes,
      })),
    ];
    const uniqueMessages = Array.from(new Map(mergedMessages.map((m) => [m.id, m])).values())
      .sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
        return a.timestamp.localeCompare(b.timestamp);
      });
    return NextResponse.json({ debate: { ...debate, messages: uniqueMessages } });
  });
}
