"use client";
import { useState, useCallback } from "react";

interface BannedPhrase {
  pattern: RegExp;
  banned: string;
  replacement: string;
  category: "metaphor" | "vagueness" | "handwaving" | "emergence";
}

const BANNED_PHRASES: BannedPhrase[] = [
  { pattern: /spontaneous symmetry breaking/gi, banned: "Spontaneous symmetry breaking", replacement: "Vacuum expectation value driven by the Mexican-hat potential with ⟨ϕ⟩ = v/√2, where v = (−μ²/λ)^{1/2}", category: "metaphor" },
  { pattern: /quantum fluctuations?/gi, banned: "Quantum fluctuation(s)", replacement: "Zero-point energy modes with amplitude ⟨0|ϕ²|0⟩ = ∫d³k/(2π)³ · 1/(2ω_k)", category: "vagueness" },
  { pattern: /(?<!\w)emergence(?!\w)/gi, banned: "Emergence", replacement: "Coarse-graining procedure: specify microscopic DOF, partition function Z, and renormalization group flow with error bounds", category: "emergence" },
  { pattern: /collapses? of the wave\s*function/gi, banned: "Collapse of the wavefunction", replacement: "Specify mechanism: Diosi-Penrose (gravitational self-energy threshold), GRW (stochastic localization rate λ), or decoherence (environment-induced superselection)", category: "vagueness" },
  { pattern: /virtual particles?/gi, banned: "Virtual particle(s)", replacement: "Off-shell internal propagator in Feynman diagram, contributing amplitude (not probability) via ∫d⁴k/(k²−m²+iε)", category: "metaphor" },
  { pattern: /quantum tunnell?ing/gi, banned: "Quantum tunneling", replacement: "WKB transmission through classically forbidden region with amplitude T ~ exp(−2∫√(2m(V−E))/ℏ dx)", category: "metaphor" },
  { pattern: /(?<!\w)observe(?:s|d|r)?\b/gi, banned: "Observe/Observer", replacement: "Interaction with apparatus: specify Hamiltonian H_int, pointer basis, and decoherence timescale", category: "vagueness" },
  { pattern: /spooky action at a distance/gi, banned: "Spooky action at a distance", replacement: "Violation of Bell inequality ⟨CHSH⟩ = 2√2 > 2, with no superluminal signaling (no-communication theorem)", category: "metaphor" },
  { pattern: /information (?:is )?lost/gi, banned: "Information is lost", replacement: "Specify: unitarity violation (S†S ≠ 1), or Page curve deviation, or entropy bound violation", category: "handwaving" },
  { pattern: /nature (?:chooses|decides|prefers|wants)/gi, banned: "Nature chooses/decides", replacement: "The dynamics governed by Lagrangian L yield...", category: "metaphor" },
];

export interface FormalismViolation {
  phrase: string;
  replacement: string;
  category: string;
  position: { start: number; end: number };
  line: number;
}

export interface ParameterAudit {
  inputs: string[];
  outputs: string[];
  freeParameters: string[];
  efficiencyRatio: number;
  status: "overconstrained" | "balanced" | "underconstrained";
}

export interface DimensionalCheck {
  expression: string;
  lhs: string;
  rhs: string;
  consistent: boolean;
  details: string;
}

export function analyzeFormalismViolations(text: string): FormalismViolation[] {
  const violations: FormalismViolation[] = [];
  const lines = text.split("\n");

  BANNED_PHRASES.forEach((bp) => {
    let match: RegExpExecArray | null;
    const regex = new RegExp(bp.pattern.source, bp.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const lineNum = text.slice(0, match.index).split("\n").length;
      violations.push({
        phrase: match[0],
        replacement: bp.replacement,
        category: bp.category,
        position: { start: match.index, end: match.index + match[0].length },
        line: lineNum,
      });
    }
  });

  return violations;
}

export function auditParameters(text: string): ParameterAudit {
  // Extract input parameters (things defined/given)
  const inputPatterns = [
    /(?:given|let|define|where|with)\s+(\w+)\s*=/gi,
    /(\w+)\s*:=\s*/g,
    /input:\s*(\w+)/gi,
  ];
  const outputPatterns = [
    /(?:predict|derive|compute|find|calculate)\s+(\w+)/gi,
    /(?:result|output|prediction):\s*(\w+)/gi,
    /(\w+)\s*=\s*.*(?:therefore|thus|hence)/gi,
  ];
  const freeParamPatterns = [
    /free param(?:eter)?s?:\s*(\w+)/gi,
    /(\w+)\s+is\s+(?:a\s+)?free\s+param/gi,
    /fitting param(?:eter)?:\s*(\w+)/gi,
  ];

  const inputs: string[] = [];
  const outputs: string[] = [];
  const freeParameters: string[] = [];

  inputPatterns.forEach((p) => {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) inputs.push(m[1]);
  });
  outputPatterns.forEach((p) => {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) outputs.push(m[1]);
  });
  freeParamPatterns.forEach((p) => {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) freeParameters.push(m[1]);
  });

  const ratio = outputs.length > 0 ? (inputs.length + freeParameters.length) / outputs.length : 0;

  return {
    inputs: [...new Set(inputs)],
    outputs: [...new Set(outputs)],
    freeParameters: [...new Set(freeParameters)],
    efficiencyRatio: Math.round(ratio * 100) / 100,
    status: ratio > 3 ? "overconstrained" : ratio < 1 ? "underconstrained" : "balanced",
  };
}

// Dimensional analysis rules
const DIMENSIONS: Record<string, string> = {
  "hbar": "M L² T⁻¹",
  "ℏ": "M L² T⁻¹",
  "h": "M L² T⁻¹",
  "c": "L T⁻¹",
  "G": "L³ M⁻¹ T⁻²",
  "k_B": "M L² T⁻² Θ⁻¹",
  "e": "A T",
  "m": "M",
  "E": "M L² T⁻²",
  "F": "M L T⁻²",
  "t": "T",
  "v": "L T⁻¹",
  "a": "L T⁻²",
  "p": "M L T⁻¹",
  "L": "M L² T⁻¹",
  "omega": "T⁻¹",
  "ω": "T⁻¹",
  "lambda": "L",
  "λ": "L",
  "rho": "M L⁻³",
  "ρ": "M L⁻³",
  "sigma": "M T⁻²",
  "σ": "M T⁻²",
  "T_H": "Θ",
  "S": "M L² T⁻² Θ⁻¹",
  "A": "L²",
  "l_P": "L",
};

export function checkDimensionalConsistency(expression: string): DimensionalCheck[] {
  const checks: DimensionalCheck[] = [];
  // Find equations of form LHS = RHS or LHS ~ RHS
  const eqPattern = /(\S+)\s*[=~≈]\s*(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = eqPattern.exec(expression)) !== null) {
    const lhs = match[1];
    const rhs = match[2];
    const lhsDim = DIMENSIONS[lhs] || "unknown";
    const rhsDim = DIMENSIONS[rhs] || "unknown";
    const consistent = lhsDim !== "unknown" && rhsDim !== "unknown" && lhsDim === rhsDim;
    checks.push({
      expression: match[0],
      lhs: `[${lhs}] = ${lhsDim}`,
      rhs: `[${rhs}] = ${rhsDim}`,
      consistent: lhsDim === "unknown" || rhsDim === "unknown" ? true : consistent,
      details: lhsDim === "unknown" || rhsDim === "unknown"
        ? "Unable to resolve all dimensions"
        : consistent
        ? "Dimensionally consistent"
        : `Mismatch: ${lhsDim} ≠ ${rhsDim}`,
    });
  }
  return checks;
}

// Component for the formalism analysis panel
export function useFormalismAnalysis() {
  const [text, setText] = useState("");
  const [violations, setViolations] = useState<FormalismViolation[]>([]);
  const [paramAudit, setParamAudit] = useState<ParameterAudit | null>(null);
  const [dimChecks, setDimChecks] = useState<DimensionalCheck[]>([]);

  const analyze = useCallback((input: string) => {
    setText(input);
    setViolations(analyzeFormalismViolations(input));
    setParamAudit(auditParameters(input));
    setDimChecks(checkDimensionalConsistency(input));
  }, []);

  return { text, violations, paramAudit, dimChecks, analyze };
}

export { BANNED_PHRASES };
