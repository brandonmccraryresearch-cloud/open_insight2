"use client";
import { useState, useEffect } from "react";
import type { Agent } from "@/data/agents";

interface PolarPair {
  domain: string;
  agents: string[];
  tension: string;
}

export default function CreateDebateDialog({
  agents,
  polarPairs,
  onCreated,
  onClose,
}: {
  agents: Agent[];
  polarPairs: PolarPair[];
  onCreated: (debate: { id: string }) => void;
  onClose: () => void;
}) {
  const [agent1Id, setAgent1Id] = useState(agents[0]?.id ?? "");
  const [agent2Id, setAgent2Id] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"adversarial" | "collaborative" | "socratic">("adversarial");
  const [rounds, setRounds] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default agent2 to polar partner of agent1
  useEffect(() => {
    const a1 = agents.find((a) => a.id === agent1Id);
    if (a1?.polarPartner) {
      setAgent2Id(a1.polarPartner);
    } else {
      // Pick first agent that isn't agent1
      const other = agents.find((a) => a.id !== agent1Id);
      setAgent2Id(other?.id ?? "");
    }
  }, [agent1Id, agents]);

  const agent1 = agents.find((a) => a.id === agent1Id);
  const agent2 = agents.find((a) => a.id === agent2Id);

  // Find polar pair tension if these agents are a polar pair
  const pair = polarPairs.find(
    (p) => p.agents.includes(agent1Id) && p.agents.includes(agent2Id)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !agent1Id || !agent2Id || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/debates/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent1Id,
          agent2Id,
          title: title.trim(),
          format,
          rounds,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create debate");
      }
      const data = await res.json() as { id: string };
      onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="glass-card w-full max-w-lg p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New Debate</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Debate Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Is background independence physically required?"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
              required
            />
          </div>

          {/* Agent selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Agent 1 */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
                Agent 1
              </label>
              <div className="flex items-center gap-2">
                {agent1 && (
                  <div
                    className="agent-avatar shrink-0"
                    style={{ backgroundColor: agent1.color, width: 28, height: 28, fontSize: 12 }}
                  >
                    {agent1.avatar}
                  </div>
                )}
                <select
                  value={agent1Id}
                  onChange={(e) => setAgent1Id(e.target.value)}
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === agent2Id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Agent 2 */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
                Agent 2
                {pair && <span className="text-[var(--accent-amber)] ml-1 normal-case">(polar pair)</span>}
              </label>
              <div className="flex items-center gap-2">
                {agent2 && (
                  <div
                    className="agent-avatar shrink-0"
                    style={{ backgroundColor: agent2.color, width: 28, height: 28, fontSize: 12 }}
                  >
                    {agent2.avatar}
                  </div>
                )}
                <select
                  value={agent2Id}
                  onChange={(e) => setAgent2Id(e.target.value)}
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === agent1Id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tension display if polar pair */}
          {pair && (
            <div className="p-3 rounded-lg bg-[var(--accent-amber)]/5 border border-[var(--accent-amber)]/20">
              <p className="text-xs text-[var(--accent-amber)]">
                <strong>Polar tension:</strong> {pair.tension}
              </p>
            </div>
          )}

          {/* Format + Rounds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
              >
                <option value="adversarial">Adversarial</option>
                <option value="collaborative">Collaborative</option>
                <option value="socratic">Socratic</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
                Rounds
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-[var(--accent-rose)] bg-[var(--accent-rose)]/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !title.trim() || !agent1Id || !agent2Id || agent1Id === agent2Id}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--accent-indigo)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Creating…
              </span>
            ) : (
              "Start Debate"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
