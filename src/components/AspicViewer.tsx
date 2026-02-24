"use client";
import { useState } from "react";

export type AttackType = "rebut" | "undercut" | "undermine";
export type ArgumentStrength = "strict" | "defeasible";

export interface Argument {
  id: string;
  agentId: string;
  claim: string;
  premises: string[];
  conclusion: string;
  strength: ArgumentStrength;
  status: "undefeated" | "defeated" | "blocking";
}

export interface Attack {
  id: string;
  attackerId: string;
  targetId: string;
  type: AttackType;
  reason: string;
}

export interface AspicFramework {
  title: string;
  arguments: Argument[];
  attacks: Attack[];
  extensions: { grounded: string[]; preferred: string[][] };
}

export const ASPIC_FRAMEWORKS: Record<string, AspicFramework> = {
  "collapse-debate": {
    title: "Does the Wavefunction Collapse?",
    arguments: [
      {
        id: "A1",
        agentId: "everett",
        claim: "The universal wavefunction never collapses",
        premises: [
          "The Schrodinger equation is universal and linear",
          "Linearity implies superposition persists at all scales",
          "Decoherence explains apparent collapse without modifying QM",
        ],
        conclusion: "Collapse is not a physical process; apparent collapse = decoherence + branching",
        strength: "strict",
        status: "undefeated",
      },
      {
        id: "A2",
        agentId: "penrose",
        claim: "Superpositions collapse at gravitational threshold",
        premises: [
          "General relativity requires definite spacetime geometry",
          "Superposition of masses = superposition of spacetimes (ill-defined)",
          "Gravitational self-energy E_G provides natural threshold",
          "Collapse timescale t ~ ℏ/E_G is testable",
        ],
        conclusion: "Objective reduction occurs when E_G exceeds ℏ/t",
        strength: "defeasible",
        status: "undefeated",
      },
      {
        id: "A3",
        agentId: "everett",
        claim: "Parsimony favors Many-Worlds",
        premises: [
          "Many-Worlds requires exactly one postulate (Schrodinger equation)",
          "Collapse theories add a new physical mechanism",
          "Occam's razor: prefer fewer postulates",
        ],
        conclusion: "Many-Worlds is more parsimonious than any collapse theory",
        strength: "defeasible",
        status: "blocking",
      },
      {
        id: "A4",
        agentId: "penrose",
        claim: "Many-Worlds has the probability problem",
        premises: [
          "In Many-Worlds, all outcomes occur with certainty",
          "Born rule probabilities require preferred branch measure",
          "Deutsch-Wallace derivation assumes controversial rationality axioms",
        ],
        conclusion: "Many-Worlds cannot derive the Born rule without circular assumptions",
        strength: "defeasible",
        status: "undefeated",
      },
      {
        id: "A5",
        agentId: "everett",
        claim: "Decoherence solves the preferred basis problem",
        premises: [
          "Environment-induced superselection (einselection) selects pointer states",
          "Decoherence timescale for macroscopic objects ~ 10⁻²⁰ s",
          "Pointer basis is determined by H_int, not observer",
        ],
        conclusion: "The preferred basis is physically determined, not subjective",
        strength: "strict",
        status: "undefeated",
      },
      {
        id: "A6",
        agentId: "penrose",
        claim: "Decoherence yields improper mixtures",
        premises: [
          "Tracing over environment gives diagonal density matrix",
          "Diagonal density matrix ≠ classical mixture (improper vs proper)",
          "Improper mixture still represents AND (superposition), not OR (definite outcome)",
        ],
        conclusion: "Decoherence alone does not explain definite outcomes",
        strength: "strict",
        status: "undefeated",
      },
    ],
    attacks: [
      { id: "att1", attackerId: "A4", targetId: "A3", type: "rebut", reason: "If Born rule cannot be derived, parsimony argument fails — Many-Worlds is incomplete, not simple" },
      { id: "att2", attackerId: "A5", targetId: "A4", type: "undercut", reason: "Decoherence + decision theory may suffice; the assumption is that branching structure is well-defined" },
      { id: "att3", attackerId: "A6", targetId: "A5", type: "undermine", reason: "Decoherence solves interference suppression but not the AND→OR transition" },
      { id: "att4", attackerId: "A1", targetId: "A2", type: "rebut", reason: "No independent evidence for gravitational collapse; standard QM suffices" },
      { id: "att5", attackerId: "A2", targetId: "A1", type: "rebut", reason: "Superposition of spacetimes is physically ill-defined without collapse" },
    ],
    extensions: {
      grounded: ["A1", "A5", "A6"],
      preferred: [["A1", "A3", "A5"], ["A2", "A4", "A6"]],
    },
  },

  "constructivism-debate": {
    title: "Mathematical Existence: Construction vs Discovery",
    arguments: [
      {
        id: "B1",
        agentId: "goedel",
        claim: "Mathematical truths exist independently",
        premises: [
          "Godel's first incompleteness theorem: true but unprovable sentences exist",
          "Truth is independent of provability",
          "Therefore mathematical reality transcends formal systems",
        ],
        conclusion: "Mathematical Platonism: objects exist in an abstract realm we discover",
        strength: "defeasible",
        status: "undefeated",
      },
      {
        id: "B2",
        agentId: "bishop",
        claim: "Only constructive proofs are valid",
        premises: [
          "Existence claims without witnesses are epistemically empty",
          "LEM fails computationally (no algorithm for P ∨ ¬P in general)",
          "Constructive proofs are programs (Curry-Howard)",
        ],
        conclusion: "Mathematics is construction, not discovery; proofs must compute",
        strength: "strict",
        status: "undefeated",
      },
      {
        id: "B3",
        agentId: "goedel",
        claim: "Constructivism is unnecessarily restrictive",
        premises: [
          "Classical mathematics proves strictly more theorems",
          "Many physically useful results require AC or LEM",
          "Restriction without physical motivation is arbitrary",
        ],
        conclusion: "Constructivism impoverishes mathematics without justification",
        strength: "defeasible",
        status: "blocking",
      },
      {
        id: "B4",
        agentId: "bishop",
        claim: "Godel's proof is itself constructive",
        premises: [
          "The Godel sentence G is explicitly constructed via diagonalization",
          "The incompleteness proof provides an algorithm",
          "Platonism is not needed to state or prove incompleteness",
        ],
        conclusion: "Incompleteness does not require Platonism — it's a constructive result",
        strength: "strict",
        status: "undefeated",
      },
    ],
    attacks: [
      { id: "att-b1", attackerId: "B2", targetId: "B1", type: "undermine", reason: "The premise 'truth independent of provability' assumes Platonism — circular" },
      { id: "att-b2", attackerId: "B4", targetId: "B1", type: "undercut", reason: "The example used to support Platonism is itself constructive" },
      { id: "att-b3", attackerId: "B3", targetId: "B2", type: "rebut", reason: "Practicality outweighs philosophical purity" },
    ],
    extensions: {
      grounded: ["B2", "B4"],
      preferred: [["B1", "B3"], ["B2", "B4"]],
    },
  },
};

export function useAspicViewer(frameworkKey: string) {
  const [selectedArg, setSelectedArg] = useState<string | null>(null);
  const [showExtension, setShowExtension] = useState<"grounded" | "preferred-1" | "preferred-2" | null>(null);
  const framework = ASPIC_FRAMEWORKS[frameworkKey];

  const getAttacksOn = (argId: string) =>
    framework?.attacks.filter((a) => a.targetId === argId) || [];

  const getAttacksFrom = (argId: string) =>
    framework?.attacks.filter((a) => a.attackerId === argId) || [];

  const isInExtension = (argId: string) => {
    if (!showExtension || !framework) return true;
    if (showExtension === "grounded") return framework.extensions.grounded.includes(argId);
    if (showExtension === "preferred-1") return framework.extensions.preferred[0]?.includes(argId);
    if (showExtension === "preferred-2") return framework.extensions.preferred[1]?.includes(argId);
    return true;
  };

  return {
    framework,
    selectedArg,
    setSelectedArg,
    showExtension,
    setShowExtension,
    getAttacksOn,
    getAttacksFrom,
    isInExtension,
  };
}
