"use client";

export type DiscoveryClass = 1 | 2 | 3;

export interface ClassificationResult {
  discoveryClass: DiscoveryClass;
  label: string;
  description: string;
  color: string;
  criteria: { name: string; met: boolean; detail: string }[];
  confidence: number;
}

const CLASS_DEFINITIONS = {
  1: {
    label: "Class 1: Synthesis",
    description: "Recombination of known results into new configuration",
    color: "#64748b",
    requirements: ["Combines existing knowledge", "No novel predictions", "Competent survey/review"],
  },
  2: {
    label: "Class 2: Analytical Insight",
    description: "Solving open problems via rigorous deduction from known principles",
    color: "#f59e0b",
    requirements: ["Derives new result from established axioms", "Formally verifiable", "Addresses recognized open question"],
  },
  3: {
    label: "Class 3: Paradigmatic Leap",
    description: "Genuinely novel framework that makes falsifiable predictions and resolves anomalies",
    color: "#10b981",
    requirements: ["Novel conceptual framework", "Makes falsifiable predictions", "Resolves existing anomalies", "Cannot be reduced to existing theories"],
  },
};

export function classifyDiscovery(text: string): ClassificationResult {
  const lower = text.toLowerCase();

  // Heuristic classification based on content analysis
  const indicators = {
    synthesis: 0,
    analytical: 0,
    paradigmatic: 0,
  };

  // Synthesis indicators
  if (lower.includes("review") || lower.includes("survey") || lower.includes("summary")) indicators.synthesis += 2;
  if (lower.includes("known result") || lower.includes("established")) indicators.synthesis += 1;
  if (lower.includes("combine") || lower.includes("synthesize") || lower.includes("collect")) indicators.synthesis += 2;

  // Analytical indicators
  if (lower.includes("derive") || lower.includes("proof") || lower.includes("theorem")) indicators.analytical += 2;
  if (lower.includes("lean 4") || lower.includes("formally verified") || lower.includes("qed")) indicators.analytical += 3;
  if (lower.includes("open problem") || lower.includes("conjecture") || lower.includes("solve")) indicators.analytical += 2;
  if (lower.includes("from first principles") || lower.includes("axiom")) indicators.analytical += 1;

  // Paradigmatic indicators
  if (lower.includes("novel framework") || lower.includes("new theory") || lower.includes("paradigm")) indicators.paradigmatic += 3;
  if (lower.includes("predict") || lower.includes("falsifiable") || lower.includes("testable")) indicators.paradigmatic += 2;
  if (lower.includes("resolves") || lower.includes("anomaly") || lower.includes("reconcile")) indicators.paradigmatic += 2;
  if (lower.includes("cannot be reduced") || lower.includes("fundamentally new")) indicators.paradigmatic += 3;

  let discoveryClass: DiscoveryClass;
  if (indicators.paradigmatic >= 5) discoveryClass = 3;
  else if (indicators.analytical >= 3) discoveryClass = 2;
  else discoveryClass = 1;

  const def = CLASS_DEFINITIONS[discoveryClass];

  const criteria = def.requirements.map((req) => {
    const words = req.toLowerCase().split(/\s+/);
    const met = words.some((w) => lower.includes(w));
    return {
      name: req,
      met,
      detail: met ? "Detected in content" : "Not detected",
    };
  });

  const metCount = criteria.filter((c) => c.met).length;
  const confidence = Math.min(95, Math.round((metCount / criteria.length) * 80 + indicators[discoveryClass === 3 ? "paradigmatic" : discoveryClass === 2 ? "analytical" : "synthesis"] * 5));

  return {
    discoveryClass,
    label: def.label,
    description: def.description,
    color: def.color,
    criteria,
    confidence,
  };
}

export { CLASS_DEFINITIONS };
