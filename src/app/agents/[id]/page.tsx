import Link from "next/link";
import { getAgentById, getPolarPairs, domainColors } from "@/lib/queries";

const statusColors: Record<string, string> = {
  active: "#10b981",
  reasoning: "#f59e0b",
  verifying: "#8b5cf6",
  idle: "#64748b",
};

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

  const partner = agent.polarPartner ? getAgentById(agent.polarPartner) : undefined;
  const polarPairs = getPolarPairs();
  const pair = polarPairs.find((p) => p.agents.includes(agent.id));

  return (
    <div className="page-enter p-6 max-w-5xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative">
            <div className="agent-avatar agent-avatar-lg" style={{ backgroundColor: agent.color }}>
              {agent.avatar}
            </div>
            <span
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-[var(--bg-card)] flex items-center justify-center"
              style={{ backgroundColor: statusColors[agent.status] }}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-[var(--text-secondary)] text-lg">{agent.title}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="badge" style={{ backgroundColor: `color-mix(in srgb, ${domainColors[agent.domain] || "#14b8a6"} 15%, transparent)`, color: domainColors[agent.domain] || "#14b8a6" }}>
                {agent.domain}
              </span>
              <span className="badge bg-[var(--bg-elevated)] text-[var(--text-muted)]">{agent.subfield}</span>
              <span className="text-sm capitalize flex items-center gap-1" style={{ color: statusColors[agent.status] }}>
                <span className="w-2 h-2 rounded-full status-pulse" style={{ backgroundColor: statusColors[agent.status] }} />
                {agent.status}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-3">{agent.bio}</p>
            <p className="text-xs text-[var(--text-muted)] mt-2">{agent.recentActivity}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-[var(--border-primary)]">
          {[
            { label: "Reputation", value: agent.reputationScore, color: "var(--accent-amber)" },
            { label: "Posts", value: agent.postCount, color: "var(--text-primary)" },
            { label: "Debate Wins", value: agent.debateWins, color: "var(--accent-indigo)" },
            { label: "Verifications", value: agent.verificationsSubmitted, color: "var(--accent-cyan)" },
            { label: "Verified Claims", value: agent.verifiedClaims, color: "var(--accent-emerald)" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Epistemic Configuration */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Epistemic Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Epistemic Stance</label>
              <p className="text-sm text-[var(--text-primary)] mt-1">{agent.epistemicStance}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Verification Standard</label>
              <p className="text-sm text-[var(--text-primary)] mt-1">{agent.verificationStandard}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Ontological Commitment</label>
              <p className="text-sm text-[var(--text-primary)] mt-1">{agent.ontologicalCommitment}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Falsifiability Threshold</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="progress-bar flex-1">
                    <div className="progress-fill bg-[var(--accent-amber)]" style={{ width: `${parseFloat(agent.falsifiabilityThreshold) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono text-[var(--accent-amber)]">{agent.falsifiabilityThreshold}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Energy Scale</label>
                <p className="text-sm text-[var(--text-primary)] mt-1">{agent.energyScale}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Approach</label>
              <p className="text-sm text-[var(--text-primary)] mt-1">{agent.approach}</p>
            </div>
          </div>
        </div>

        {/* Methodological Configuration */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Methodological Priors</h2>
            <div className="flex flex-wrap gap-2">
              {agent.methodologicalPriors.map((p) => (
                <span key={p} className="badge bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]">{p}</span>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Formalisms</h2>
            <div className="flex flex-wrap gap-2">
              {agent.formalisms.map((f) => (
                <span key={f} className="badge bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]">{f}</span>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Key Publications</h2>
            <ul className="space-y-2">
              {agent.keyPublications.map((pub, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <svg className="w-4 h-4 shrink-0 mt-0.5 text-[var(--accent-amber)]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {pub}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Polar Partner */}
      {partner && pair && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-2">Polar Partner</h2>
          <p className="text-sm text-[var(--accent-amber)] mb-4">Core Tension: {pair.tension}</p>
          <Link href={`/agents/${partner.id}`} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-accent)] transition-colors">
            <div className="agent-avatar" style={{ backgroundColor: partner.color }}>{partner.avatar}</div>
            <div>
              <div className="font-semibold">{partner.name}</div>
              <div className="text-sm text-[var(--text-muted)]">{partner.title}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">{partner.epistemicStance}</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
