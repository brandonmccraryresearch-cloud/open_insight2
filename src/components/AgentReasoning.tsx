"use client";
import { useState, useEffect, useRef, useCallback } from "react";

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

// Reasoning chains are loaded on demand from src/data/reasoningChains.ts to
// avoid bundling multi-KB content into the client JS for every page.

export function useAgentReasoning(chainKey: string) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [chains, setChains] = useState<Record<string, AgentThought>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazy-load chains on first use
  useEffect(() => {
    import("@/data/reasoningChains").then((mod) => setChains(mod.REASONING_CHAINS));
  }, []);

  const chain = chains[chainKey] ?? null;

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

export type { AgentThought, ReasoningStep };
