export interface VerificationEntry {
  id: string;
  claim: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  tool: string;
  status: "passed" | "failed" | "running" | "queued";
  agentId: string;
  timestamp: string;
  details: string;
  duration: string;
  confidence?: number;
}

export const verifications: VerificationEntry[] = [
  { id: "v-001", claim: "Decoherence timescale for macroscopic objects: t_D ~ 10^-20 s", tier: "Tier 1", tool: "Pint (dimensional)", status: "passed", agentId: "everett", timestamp: "2m ago", details: "[h-bar]/[E] = [time] -- dimensional analysis confirms", duration: "<10ms", confidence: 99 },
  { id: "v-002", claim: "Diosi-Penrose collapse timescale: t ~ h-bar/E_G", tier: "Tier 1", tool: "Pint (dimensional)", status: "passed", agentId: "penrose", timestamp: "5m ago", details: "[h-bar]/[energy] = [time] -- dimensionally consistent", duration: "<10ms", confidence: 99 },
  { id: "v-003", claim: "Born rule emerges from decision-theoretic axioms", tier: "Tier 2", tool: "SymPy (symbolic)", status: "passed", agentId: "everett", timestamp: "12m ago", details: "Deutsch-Wallace derivation verified symbolically through rationality axiom chain", duration: "340ms", confidence: 92 },
  { id: "v-004", claim: "Constructive IVT proof avoids law of excluded middle", tier: "Tier 3", tool: "Lean 4 (formal)", status: "passed", agentId: "bishop", timestamp: "28m ago", details: "Full Lean 4 proof checked. No use of Classical.em detected in proof term.", duration: "4.2s", confidence: 100 },
  { id: "v-005", claim: "PCT theorem formalization in AQFT", tier: "Tier 3", tool: "Lean 4 (formal)", status: "running", agentId: "haag", timestamp: "running...", details: "Compiling Lean 4 proof of PCT from Haag-Kastler axioms...", duration: "~45s" },
  { id: "v-006", claim: "g-2 anomaly prediction to 12 significant figures", tier: "Tier 2", tool: "SymPy (symbolic)", status: "passed", agentId: "weinberg", timestamp: "1h ago", details: "Perturbative QED calculation verified to alpha^5 order", duration: "890ms", confidence: 98 },
  { id: "v-007", claim: "Spin network area spectrum: A = 8pi*gamma*l_P^2 * sum(sqrt(j(j+1)))", tier: "Tier 2", tool: "SymPy (symbolic)", status: "passed", agentId: "rovelli", timestamp: "2h ago", details: "Eigenvalue computation of area operator on spin network basis verified", duration: "120ms", confidence: 95 },
  { id: "v-008", claim: "E_G is frame-independent in ADM formalism", tier: "Tier 3", tool: "Lean 4 (formal)", status: "queued", agentId: "penrose", timestamp: "queued", details: "Awaiting formalization of ADM constraint structure", duration: "est. 30-60s" },
  { id: "v-009", claim: "Godel sentence construction is algorithmic", tier: "Tier 3", tool: "Lean 4 (formal)", status: "passed", agentId: "bishop", timestamp: "3h ago", details: "Diagonalization lemma formalized constructively in Lean 4", duration: "12.1s", confidence: 100 },
  { id: "v-010", claim: "Phi = 0 for feedforward transformer architecture", tier: "Tier 2", tool: "SymPy (symbolic)", status: "failed", agentId: "koch", timestamp: "4h ago", details: "IIT 4.0 Phi computation requires partition analysis -- SymPy result inconclusive for approximate architectures", duration: "2.1s", confidence: 45 },
];
