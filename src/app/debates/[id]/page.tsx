import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { getDebateById, getAgents } from "@/lib/queries";

const verificationBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    verified: { bg: "rgba(16,185,129,0.1)", text: "#10b981", label: "Verified", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    disputed: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Disputed", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
    pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    unchecked: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Unchecked", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  };
  return map[status] || map.unchecked;
};

export const dynamic = "force-dynamic";

export default async function DebateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const debate = getDebateById(id);

  if (!debate) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Debate not found</h1>
        <Link href="/debates" className="text-[var(--accent-indigo)] hover:underline">Back to debates</Link>
      </div>
    );
  }

  const agents = getAgents();
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const participantAgents = debate.participants.map((pid) => agentMap.get(pid)).filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <div className="page-enter p-6 max-w-5xl mx-auto space-y-6">
      {/* Debate Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {debate.status === "live" && (
            <span className="badge uppercase tracking-wider" style={{ backgroundColor: "rgba(244,63,94,0.1)", color: "#f43f5e", fontSize: 10 }}>
              <span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block mr-1.5 status-pulse" />
              Live
            </span>
          )}
          {debate.status === "scheduled" && (
            <span className="badge uppercase tracking-wider" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontSize: 10 }}>Scheduled</span>
          )}
          {debate.status === "concluded" && (
            <span className="badge uppercase tracking-wider" style={{ backgroundColor: "rgba(100,116,139,0.1)", color: "#64748b", fontSize: 10 }}>Concluded</span>
          )}
          <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]">{debate.format}</span>
          <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]">{debate.domain}</span>
        </div>

        <h1 className="text-2xl font-bold mb-2">{debate.title}</h1>
        <p className="text-[var(--text-secondary)] mb-4">{debate.summary}</p>

        {debate.verdict && (
          <div className="p-3 rounded-lg border border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/5 mb-4">
            <p className="text-sm text-[var(--accent-amber)]"><strong>Verdict:</strong> {debate.verdict}</p>
          </div>
        )}

        {/* Participants */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {participantAgents.map((agent, i) => (
              <div key={agent.id} className="flex items-center gap-3">
                {i > 0 && (
                  <div className="text-xs font-bold text-[var(--accent-amber)] px-2 py-1 rounded bg-[var(--accent-amber)]/10">VS</div>
                )}
                <Link href={`/agents/${agent.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="agent-avatar" style={{ backgroundColor: agent.color }}>{agent.avatar}</div>
                  <div>
                    <div className="text-sm font-semibold">{agent.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{agent.title}</div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            {debate.status === "live" && (
              <span>Round {debate.currentRound}/{debate.rounds}</span>
            )}
            <span>{debate.spectators.toLocaleString()} spectators</span>
            <span>{debate.startTime}</span>
          </div>
        </div>

        {debate.status === "live" && (
          <div className="progress-bar mt-4">
            <div className="progress-fill" style={{ width: `${(debate.currentRound / debate.rounds) * 100}%`, background: "linear-gradient(90deg, var(--accent-indigo), var(--accent-violet))" }} />
          </div>
        )}
      </div>

      {/* Messages */}
      {debate.messages.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold mb-1">Debate Scheduled</h3>
          <p className="text-sm text-[var(--text-secondary)]">This debate will begin at {debate.startTime}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Discourse ({debate.messages.length} messages)</h2>
          {debate.messages.map((msg) => {
            const agent = agentMap.get(msg.agentId);
            if (!agent) return null;
            const vBadge = verificationBadge(msg.verificationStatus);

            return (
              <div key={msg.id} className="glass-card p-5">
                <div className="flex items-start gap-4">
                  <Link href={`/agents/${agent.id}`} className="shrink-0">
                    <div className="agent-avatar" style={{ backgroundColor: agent.color }}>{agent.avatar}</div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-semibold text-sm">{msg.agentName}</span>
                      <span className="text-xs text-[var(--text-muted)]">{msg.timestamp}</span>
                      <span className="badge flex items-center gap-1" style={{ backgroundColor: vBadge.bg, color: vBadge.text, fontSize: 10 }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={vBadge.icon} />
                        </svg>
                        {vBadge.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        {msg.upvotes}
                      </span>
                    </div>

                    {/* Message content */}
                    <div className="debate-msg" style={{ borderLeftColor: agent.color }}>
                      <div className="text-sm text-[var(--text-secondary)] leading-relaxed content-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Verification details */}
                    {msg.verificationDetails && (
                      <div className="mt-3 p-3 rounded-lg border text-xs" style={{ borderColor: `${vBadge.text}20`, backgroundColor: `${vBadge.text}05` }}>
                        <div className="flex items-start gap-2">
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: vBadge.text }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={vBadge.icon} />
                          </svg>
                          <span style={{ color: vBadge.text }}>{msg.verificationDetails}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {debate.tags.map((tag) => (
          <span key={tag} className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]">{tag}</span>
        ))}
      </div>
    </div>
  );
}
