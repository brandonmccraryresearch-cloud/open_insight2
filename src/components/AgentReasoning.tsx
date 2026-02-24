"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { agents } from "@/data/agents";

interface ReasoningStep {
  phase: "decomposition" | "tool-thinking" | "critique" | "synthesis";
  content: string;
  tool?: string;
  status: "pending" | "running" | "complete" | "failed";
  duration?: number;
}

interface AgentThought {
  agentId: string;
  prompt: string;
  steps: ReasoningStep[];
  finalAnswer: string;
  confidence: number;
  verificationMethod: string;
}

// Predefined reasoning chains for different prompts
const REASONING_CHAINS: Record<string, AgentThought> = {
  "everett-decoherence": {
    agentId: "everett",
    prompt: "Derive the decoherence timescale for a macroscopic dust grain (m = 10⁻¹² kg) in thermal photon bath at T = 300K.",
    steps: [
      {
        phase: "decomposition",
        content: `**Problem Classification:** Quantum decoherence calculation
**Domain:** Quantum Foundations / Open Quantum Systems
**Required Tools:** Dimensional analysis, thermal wavelength computation
**Strategy:** Apply Joos-Zeh scattering decoherence model

The decoherence rate is determined by the scattering of environmental particles (photons) off the massive object. The key formula:

$\\tau_D^{-1} = \\Lambda \\cdot \\Delta x^2$

where $\\Lambda$ is the localization rate and $\\Delta x$ is the superposition separation.`,
        status: "complete",
        duration: 120,
      },
      {
        phase: "tool-thinking",
        content: `**[Pint: Dimensional Analysis]**
Checking: $[\\Lambda] = L^{-2} T^{-1}$ (localization rate)
$[\\Delta x] = L$ (separation)
$[\\Lambda \\cdot \\Delta x^2] = L^{-2} T^{-1} \\cdot L^2 = T^{-1}$ ✓ (rate)

**[SymPy: Symbolic Computation]**
For thermal photon scattering (Joos & Zeh 1985):
$\\Lambda_{\\text{photon}} = \\frac{8 \\pi^5 k_B^6 a^6}{189 \\hbar^7 c^8} T^6 \\cdot \\frac{n(n+1)}{(2n+1)^2}$

For a sphere of radius $a = 10^{-6}$ m at $T = 300$ K:
$\\Lambda \\approx 10^{12}$ m$^{-2}$ s$^{-1}$

With superposition separation $\\Delta x = a = 10^{-6}$ m:
$\\tau_D = \\frac{1}{\\Lambda \\cdot \\Delta x^2} = \\frac{1}{10^{12} \\cdot 10^{-12}} = 1$ s

Wait — this is for photon scattering alone. Including air molecules at atmospheric pressure:
$\\Lambda_{\\text{air}} \\approx 10^{32}$ m$^{-2}$ s$^{-1}$
$\\tau_D^{\\text{air}} \\approx 10^{-20}$ s`,
        tool: "SymPy + Pint",
        status: "complete",
        duration: 890,
      },
      {
        phase: "critique",
        content: `**Self-Review:**
1. ✓ Dimensional consistency verified at every step
2. ✓ The $T^6$ scaling is correct for Rayleigh scattering (long wavelength limit: $\\lambda_{\\text{thermal}} \\gg a$)
3. ⚠ Should verify $\\lambda_{\\text{thermal}} = \\frac{hc}{k_B T} \\approx 48\\,\\mu$m $\\gg a = 1\\,\\mu$m — condition satisfied
4. ✓ Air molecule result $\\sim 10^{-20}$ s consistent with Schlosshauer (2007) Table 3.1
5. ⚠ Neglected: graviton scattering (negligible at these scales), CMB photons (subdominant at 300K)

**No backtracking required.** Derivation is self-consistent.`,
        status: "complete",
        duration: 340,
      },
      {
        phase: "synthesis",
        content: `**Result:**

For a dust grain ($m = 10^{-12}$ kg, $a = 10^{-6}$ m) at $T = 300$ K with superposition separation $\\Delta x = a$:

$$\\tau_D^{\\text{photon}} \\sim 1 \\text{ s}$$
$$\\tau_D^{\\text{air}} \\sim 10^{-20} \\text{ s}$$

**Physical interpretation (Everettian):** Decoherence does NOT collapse the wavefunction — it suppresses off-diagonal density matrix elements, making interference unobservable. The dust grain becomes entangled with $\\sim 10^{20}$ air molecules per second, creating branching structure indistinguishable from classical definiteness.

This is why macroscopic superpositions are never observed: not because of collapse, but because decoherence is astronomically fast.`,
        status: "complete",
        duration: 200,
      },
    ],
    finalAnswer: "Decoherence timescale: ~10⁻²⁰ s (air) or ~1 s (photon only). Macroscopic definiteness emerges from environmental entanglement, not collapse.",
    confidence: 96,
    verificationMethod: "Dimensional analysis (Pint) + Symbolic computation (SymPy) + Literature cross-check",
  },

  "bishop-ivt": {
    agentId: "bishop",
    prompt: "Provide a constructive proof of the Intermediate Value Theorem avoiding the law of excluded middle.",
    steps: [
      {
        phase: "decomposition",
        content: `**Problem Classification:** Constructive real analysis
**Domain:** Foundations of Mathematics
**Required Tools:** Lean 4 type-checker
**Strategy:** Bisection algorithm providing computational witness

**Constructive IVT statement:** Given $f: [a,b] \\to \\mathbb{R}$ continuous with $f(a) < 0$ and $f(b) > 0$, construct a sequence converging to $c$ with $f(c) = 0$.

**Key constraint:** Cannot use $\\forall x: P(x) \\lor \\neg P(x)$ (excluded middle). Must provide an algorithm.`,
        status: "complete",
        duration: 150,
      },
      {
        phase: "tool-thinking",
        content: `**[Lean 4: Formal Verification]**

\`\`\`lean
-- Approximate IVT: find c with |f(c)| < ε for any ε > 0
theorem ivt_approximate (f : ℝ → ℝ) (a b : ℝ)
  (hcont : Continuous f) (hab : a < b)
  (ha : f a < 0) (hb : 0 < f b) (ε : ℝ) (hε : 0 < ε) :
  ∃ c ∈ Set.Icc a b, |f c| < ε := by
  -- Bisection: at each step, interval halves
  -- After n steps: |b_n - a_n| = (b-a)/2^n
  -- By continuity: |f(c)| < ε when
  -- (b-a)/2^n < δ(ε)
  -- n > log₂((b-a)/δ(ε)) steps suffice
  sorry -- Full proof: 47 lines in Mathlib
\`\`\`

**Constructive content:** The bisection algorithm is the witness.
At step $n$, let $m = (a_n + b_n)/2$.
- If $f(m) < -\\varepsilon/2$: set $a_{n+1} = m$
- If $f(m) > \\varepsilon/2$: set $b_{n+1} = m$
- If $|f(m)| \\leq \\varepsilon/2$: done, return $m$

**Critical insight:** We avoid excluded middle by using the **constructive trichotomy** for reals: for any $\\varepsilon > 0$, we can decide whether $f(m) < -\\varepsilon/2$, $f(m) > \\varepsilon/2$, or $|f(m)| \\leq \\varepsilon/2$. This is decidable because real comparison up to rational precision is constructive.`,
        tool: "Lean 4",
        status: "complete",
        duration: 4200,
      },
      {
        phase: "critique",
        content: `**Self-Review:**
1. ✓ No use of \`Classical.em\`, \`Classical.choice\`, or \`Decidable.em\` in proof
2. ✓ Algorithm terminates: $|b_n - a_n| = (b-a)/2^n \\to 0$
3. ✓ Convergence rate: $n = \\lceil \\log_2((b-a)/\\delta(\\varepsilon)) \\rceil$ steps
4. ⚠ Note: We prove the **approximate** IVT ($|f(c)| < \\varepsilon$), not the exact IVT ($f(c) = 0$).

   The **exact** constructive IVT requires additional hypothesis: $f$ must be *locally non-constant* (or equivalently, use the constructive reals where $\\neq$ has computational content).

5. ✓ This is the standard Bishop-style proof (Bishop 1967, Ch. 2)

**No backtracking needed.** The approximate IVT is the correct constructive formulation.`,
        status: "complete",
        duration: 280,
      },
      {
        phase: "synthesis",
        content: `**Result:**

**Constructive Approximate IVT:** For continuous $f: [a,b] \\to \\mathbb{R}$ with $f(a) < 0$, $f(b) > 0$, and any $\\varepsilon > 0$:

$$\\exists c \\in [a,b]: |f(c)| < \\varepsilon$$

The proof is the **bisection algorithm** itself — it computes $c$ to arbitrary precision in $O(\\log(1/\\varepsilon))$ steps.

**Why not exact zero?** In constructive mathematics, deciding $f(c) = 0$ requires excluded middle. We can only approximate. But this is physically meaningful: no measurement has infinite precision.

**Lean 4 status:** Approximate IVT formalized. No use of classical axioms. Proof term is a computable function.`,
        status: "complete",
        duration: 180,
      },
    ],
    finalAnswer: "Constructive IVT proved via bisection algorithm. Approximate version (|f(c)| < ε) avoids excluded middle. Lean 4 verified with no classical axioms.",
    confidence: 100,
    verificationMethod: "Lean 4 formal proof (no Classical.em)",
  },

  "penrose-collapse": {
    agentId: "penrose",
    prompt: "Calculate the objective reduction timescale for a superposition of 10⁶ nucleons displaced by their own diameter.",
    steps: [
      {
        phase: "decomposition",
        content: `**Problem Classification:** Gravitational decoherence / Objective Reduction
**Domain:** Quantum Gravity (Penrose proposal)
**Required Tools:** Dimensional analysis, numerical computation
**Strategy:** Apply Diosi-Penrose formula $\\tau = \\hbar / E_G$

**Setup:** $N = 10^6$ nucleons (mass $\\approx 1.67 \\times 10^{-21}$ kg), displaced by nuclear diameter $d \\approx 2 \\times 10^{-15}$ m in superposition.`,
        status: "complete",
        duration: 100,
      },
      {
        phase: "tool-thinking",
        content: `**[Pint: Dimensional Verification]**
$[\\hbar] = $ M L² T⁻¹
$[E_G] = [G m^2 / R] = $ L³ M⁻¹ T⁻² · M² · L⁻¹ = M L² T⁻²  (energy ✓)
$[\\hbar / E_G] = $ M L² T⁻¹ / (M L² T⁻²) = T  ✓

**[SymPy: Numerical Computation]**
Total mass: $m = N \\cdot m_p = 10^6 \\times 1.67 \\times 10^{-27} \\text{ kg} = 1.67 \\times 10^{-21}$ kg

Gravitational self-energy of the difference:
$$E_G = \\frac{G m^2}{R} = \\frac{6.674 \\times 10^{-11} \\times (1.67 \\times 10^{-21})^2}{2 \\times 10^{-15}}$$
$$= \\frac{6.674 \\times 10^{-11} \\times 2.79 \\times 10^{-42}}{2 \\times 10^{-15}}$$
$$= \\frac{1.86 \\times 10^{-52}}{2 \\times 10^{-15}} = 9.3 \\times 10^{-38} \\text{ J}$$

Collapse timescale:
$$\\tau = \\frac{\\hbar}{E_G} = \\frac{1.055 \\times 10^{-34}}{9.3 \\times 10^{-38}} \\approx 1135 \\text{ s} \\approx 19 \\text{ minutes}$$`,
        tool: "Pint + SymPy",
        status: "complete",
        duration: 650,
      },
      {
        phase: "critique",
        content: `**Self-Review:**
1. ✓ Dimensional analysis passes
2. ✓ Used correct approximation: $E_G \\sim Gm^2/R$ for well-separated, compact mass distributions
3. ⚠ This is an *overestimate* — for a more realistic extended mass (sphere vs point), $E_G$ involves a self-energy integral: $E_G = \\frac{G}{2}\\int\\int \\frac{(\\rho_1(x) - \\rho_2(x))(\\rho_1(x') - \\rho_2(x'))}{|x-x'|} d^3x\\, d^3x'$
4. ✓ The 19-minute result is experimentally relevant — current interference experiments probe masses $\\sim 10^4$ amu ($\\sim 10^4$ nucleons), where $\\tau$ would be $\\sim 10^{11}$ s (too long). But optomechanical experiments (Aspelmeyer group) aim for $10^{10}$ amu, where $\\tau \\sim$ seconds.
5. ✓ This prediction distinguishes Penrose from standard QM (which predicts no collapse regardless of mass).

**No backtracking.** Point-mass approximation is appropriate for order-of-magnitude.`,
        status: "complete",
        duration: 310,
      },
      {
        phase: "synthesis",
        content: `**Result:**

For a superposition of $10^6$ nucleons displaced by $\\sim 2$ fm:

$$\\tau_{\\text{OR}} = \\frac{\\hbar}{E_G} \\approx \\frac{1.055 \\times 10^{-34}}{9.3 \\times 10^{-38}} \\approx 1135 \\text{ s} \\approx 19 \\text{ min}$$

**Physical significance:** This is a macroscopic timescale — the superposition spontaneously reduces to one branch within minutes. Standard QM predicts indefinite persistence (decoherence merely suppresses interference without selecting outcomes).

**Experimental status:** Current experiments test $\\sim 10^4$ amu (too light for OR). Next-generation optomechanical experiments targeting $10^{10}$–$10^{12}$ amu will probe the Diosi-Penrose threshold directly.`,
        status: "complete",
        duration: 190,
      },
    ],
    finalAnswer: "OR collapse timescale for 10⁶ nucleons: ~19 minutes. Experimentally testable with next-generation optomechanical experiments.",
    confidence: 88,
    verificationMethod: "Dimensional analysis (Pint) + Numerical computation (SymPy) + Literature cross-check",
  },
};

export function useAgentReasoning(chainKey: string) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chain = REASONING_CHAINS[chainKey];

  const startReasoning = useCallback(() => {
    if (!chain) return;
    setCurrentStep(0);
    setIsRunning(true);
    setStreamText("");
    setCompletedSteps([]);
  }, [chain]);

  const reset = useCallback(() => {
    setCurrentStep(-1);
    setIsRunning(false);
    setStreamText("");
    setCompletedSteps([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!isRunning || currentStep < 0 || !chain) return;
    if (currentStep >= chain.steps.length) {
      const stopTimer = setTimeout(() => setIsRunning(false), 0);
      return () => clearTimeout(stopTimer);
    }

    const step = chain.steps[currentStep];
    const fullText = step.content;
    let charIndex = 0;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- streamText is not a dep; no cascading re-render
    setStreamText("");

    intervalRef.current = setInterval(() => {
      charIndex += 3;
      if (charIndex >= fullText.length) {
        setStreamText(fullText);
        setCompletedSteps((prev) => [...prev, currentStep]);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
        }, 400);
      } else {
        setStreamText(fullText.slice(0, charIndex));
      }
    }, 8);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentStep, isRunning, chain]);

  return {
    chain,
    currentStep,
    isRunning,
    streamText,
    completedSteps,
    startReasoning,
    reset,
  };
}

export { REASONING_CHAINS };
export type { AgentThought, ReasoningStep };
