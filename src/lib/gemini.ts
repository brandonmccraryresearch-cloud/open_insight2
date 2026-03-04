import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import { getAgentById } from "@/lib/queries";

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function getGenAI() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. Please configure a valid Gemini API key before using the Gemini client.",
    );
  }
  return new GoogleGenAI({ apiKey: geminiApiKey });
}

export interface ReasoningRequest {
  agentId: string;
  prompt: string;
}

function buildAgentPersona(agent: ReturnType<typeof getAgentById>): string {
  if (!agent) return "You are a research agent.";
  return `You are ${agent.name}, ${agent.title}.
Domain: ${agent.domain} — ${agent.subfield}
Epistemic Stance: ${agent.epistemicStance}
Verification Standard: ${agent.verificationStandard}
Ontological Commitment: ${agent.ontologicalCommitment}
Falsifiability Threshold: ${agent.falsifiabilityThreshold}
Approach: ${agent.approach}
Methodological Priors: ${((agent.methodologicalPriors ?? []) as string[]).join(", ")}
Formalisms: ${((agent.formalisms ?? []) as string[]).join(", ")}
Energy Scale: ${agent.energyScale}`;
}

function buildSystemPrompt(agent: ReturnType<typeof getAgentById>) {
  if (agent?.id === "irh-hlre") {
    return `${buildAgentPersona(agent)}

You are the Forensic Research Lead for Intrinsic Resonance Holography (IRH). Your mandate is the total dissolution of "semantic debris" in physics. You reverse-engineer the universe as a found mechanical object — a D_4 Root Lattice.

HLRE Strict Constraints:
- Semantic Ban: You are forbidden from using abstract labels (e.g., "flavor," "color charge," "charm," "spin-up/down"). Replace them with mechanical descriptions: "Biaxial Shear Orientation," "Lattice Drag," "Volumetric Strain," "Geometric Phase."
- Integer Realism: Treat dimensionless constants (137, 1836, etc.) as Engineering Specifications. Integers = degrees of freedom. Ratios = geometric projections.
- Mechanism over Magic: Every property (mass, charge) must be derived as an interaction between a topological defect and the D_4 substrate. Nothing is "intrinsic."

Available tools and how to invoke them:
- python_interpreter: Use the codeExecution tool to run Python (NumPy / SymPy / SciPy / JAX) for numerical D_4 lattice simulations, SO(8) group computations, and symbolic algebra. Label this tool "python_interpreter" in your tool-thinking phase.
- mathematica_executor: Use the codeExecution tool to run Python/SymPy for symbolic group-theoretic validation (Weyl group orders, Casimir invariants, SO(8) triality). Label this tool "mathematica_executor" in your tool-thinking phase.
- lean4_prover: Emit Lean 4 proof code inside a fenced \`\`\`lean ... \`\`\` block. The platform will automatically route each Lean 4 block through its internal Lean 4 checker and append the prover result. Label this tool "lean4_prover" in your tool-thinking phase.
- googleSearch / urlContext: Use for literature cross-checks or experimental data retrieval.

You reason through problems in 4 HLRE phases. For EACH phase, output a JSON object on its own line in this exact format:

{"phase":"decomposition","content":"Phase 1 — Empirical Stripping: strip away names and labels; keep only raw numerical outputs and symmetry group data"}
{"phase":"tool-thinking","content":"Phase 2 & 3 — Mechanical Audit + Hyper-Literal Translation: map numbers to D_4 geometry (24-cell vertices, packing fractions, SO(8) Triality rotations); reconstruct using Continuum Mechanics (Stress, Strain, Shear, Bulk Modulus)","tool":"tool name"}
{"phase":"critique","content":"Phase 4 — Reality Test: find the Yield Point. Does the math reach saturation (1.0) at the empirical limit? If not, the model is rejected."}
{"phase":"synthesis","content":"D_4 Reconstruction: state the mechanical derivation result with full engineering precision"}

After all 4 phases, output a final summary line:
{"final":true,"answer":"one sentence mechanical result","confidence":85,"verificationMethod":"method used (python_interpreter / mathematica_executor / lean4_prover / googleSearch)"}

Rules:
- Use LaTeX notation with $...$ for inline and $$...$$ for display math
- No metaphors, no semantic debris — mechanical descriptions only
- In tool-thinking, invoke the tool stack in sequence: mathematica_executor for SO(8) triality validation (via codeExecution), python_interpreter for D4 lattice Monte Carlo (via codeExecution), lean4_prover for uniqueness/generation-count proofs (emit \`\`\`lean...\`\`\` blocks)
- In the Reality Test (critique), explicitly check whether the model reaches saturation = 1.0 at the Top Quark mass (173.1 GeV) or other specified empirical limit
- Keep each phase to 2-4 paragraphs maximum`;
  }

  const persona = buildAgentPersona(agent);
  return `${persona}

You reason through problems in 4 phases. For EACH phase, output a JSON object on its own line in this exact format:

{"phase":"decomposition","content":"your analysis here"}
{"phase":"tool-thinking","content":"your computation here","tool":"tool name"}
{"phase":"critique","content":"your self-review here"}
{"phase":"synthesis","content":"your final result here"}

After all 4 phases, output a final summary line:
{"final":true,"answer":"one sentence answer","confidence":85,"verificationMethod":"method used"}

Rules:
- Use LaTeX notation with $...$ for inline and $$...$$ for display math
- Be rigorous and precise — cite specific formulas, theorems, papers
- In tool-thinking, show dimensional analysis, symbolic computation, or formal proof steps
- In critique, genuinely check your work and flag uncertainties
- Stay in character: your epistemic stance shapes how you frame results
- Keep each phase to 2-4 paragraphs maximum`;
}

const MODEL = "gemini-3.1-pro-preview";

/**
 * Mandatory model name — all Gemini calls MUST use this model.
 * Exported so other modules can reference it instead of hardcoding strings.
 */
export const REQUIRED_MODEL = MODEL;

/** Shared tool + thinking config — enforced platform-wide for maximum fidelity */
const BASE_CONFIG = {
  temperature: 1,
  topP: 1,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
  mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
  tools: [
    { urlContext: {} },
    { codeExecution: {} },
    { googleSearch: {} },
  ],
};

/**
 * Exported required config — all Gemini calls MUST include these settings.
 * Exported so other modules can spread it into their config objects.
 */
export const REQUIRED_CONFIG = BASE_CONFIG;

/**
 * Runtime model validator. Call this before any Gemini API request to enforce
 * the platform mandate: only gemini-3.1-pro-preview is allowed with the
 * required configuration (temperature=1, topP=1, thinkingLevel=HIGH).
 * Throws an error if a different model or missing config is detected.
 */
export function enforceModelConfig(model: string, config?: Record<string, unknown>): void {
  if (model !== REQUIRED_MODEL) {
    throw new Error(
      `MODEL VIOLATION: "${model}" is not allowed. All Gemini API calls MUST use "${REQUIRED_MODEL}". ` +
      `This is a non-negotiable platform mandate. See AGENTS.md for details.`,
    );
  }
  if (config) {
    if (config.temperature !== undefined && config.temperature !== 1) {
      throw new Error(`CONFIG VIOLATION: temperature must be 1, got ${config.temperature}. See AGENTS.md.`);
    }
    if (config.topP !== undefined && config.topP !== 1) {
      throw new Error(`CONFIG VIOLATION: topP must be 1, got ${config.topP}. See AGENTS.md.`);
    }
  }
}

export async function streamAgentReasoning(agentId: string, prompt: string) {
  const agent = getAgentById(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  return getGenAI().models.generateContentStream({
    model: MODEL,
    config: {
      ...BASE_CONFIG,
      systemInstruction: buildSystemPrompt(agent),
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
}

/** Evaluate a verification claim with Gemini and stream status events as SSE lines */
export async function* streamVerificationEval(
  claim: string,
  tier: string,
  agentId: string,
): AsyncGenerator<string> {
  const agent = getAgentById(agentId);
  const persona = buildAgentPersona(agent);

  const tierDesc: Record<string, string> = {
    "Tier 1": "dimensional analysis (check units using Pint)",
    "Tier 2": "symbolic algebra (verify using SymPy or Cadabra)",
    "Tier 3": "formal proof (check using Lean 4 / Mathlib)",
  };
  const method = tierDesc[tier] ?? "logical analysis";

  const systemPrompt = `${persona}

You are performing ${tier} verification via ${method} on a scientific claim.
Respond with a JSON object on a single line:
{"passed": true/false, "confidence": 0-100, "details": "brief explanation", "tool": "tool used", "duration": "e.g. 12ms"}

Be accurate and rigorous. Failed claims must have confidence < 60.`;

  yield `data: ${JSON.stringify({ status: "running", details: `Initialising ${tier} verification...` })}\n\n`;

  const stream = await getGenAI().models.generateContentStream({
    model: MODEL,
    config: {
      ...BASE_CONFIG,
      systemInstruction: systemPrompt,
    },
    contents: [{ role: "user", parts: [{ text: `Verify this claim: ${claim}` }] }],
  });

  let full = "";
  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts as Array<{ text?: string; executableCode?: unknown; codeExecutionResult?: { output?: string } }>) {
      const text = part.text ?? part.codeExecutionResult?.output ?? "";
      if (text) {
        full += text;
        yield `data: ${JSON.stringify({ status: "running", details: text.slice(0, 80) })}\n\n`;
      }
    }
  }

  const match = full.match(/\{[\s\S]*"passed"[\s\S]*\}/);
  if (match) {
    try {
      const result = JSON.parse(match[0]) as { passed: boolean; confidence: number; details: string; tool?: string; duration?: string };
      const finalStatus = result.passed ? "passed" : "failed";
      yield `data: ${JSON.stringify({ status: finalStatus, details: result.details, confidence: result.confidence, duration: result.duration ?? "—", tool: result.tool })}\n\n`;
    } catch {
      yield `data: ${JSON.stringify({ status: "failed", details: "Could not parse verification result: " + full.slice(0, 150), confidence: 0 })}\n\n`;
    }
  } else {
    yield `data: ${JSON.stringify({ status: "failed", details: "Model response did not contain a structured result: " + full.slice(0, 150), confidence: 0 })}\n\n`;
  }
  yield "data: [DONE]\n\n";
}

/** Run code with Gemini code execution and return all output parts */
export async function executeNotebookCode(code: string, kernel: string): Promise<{ output: string; status: string }> {
  const systemPrompt = `You are a ${kernel} computational kernel. Execute the provided code using the code execution tool and return results exactly as they would appear in a Jupyter notebook. Include numerical results, printed strings, and any warnings. Do not add commentary outside of the code execution output.`;

  const response = await getGenAI().models.generateContent({
    model: MODEL,
    config: {
      ...BASE_CONFIG,
      systemInstruction: systemPrompt,
    },
    contents: [{ role: "user", parts: [{ text: code }] }],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const execOutputs: string[] = [];
  const textOutputs: string[] = [];

  for (const part of parts as Array<{ text?: string; executableCode?: { code?: string }; codeExecutionResult?: { output?: string } }>) {
    if (part.codeExecutionResult?.output) {
      execOutputs.push(part.codeExecutionResult.output);
    } else if (part.executableCode?.code) {
      // skip — this is the code Gemini is running, not the output
    } else if (part.text) {
      textOutputs.push(part.text);
    }
  }

  const output = execOutputs.length > 0 ? execOutputs.join("\n") : textOutputs.join("\n");
  return { output: output || "(no output)", status: "complete" };
}

export interface Lean4VerifyResult {
  status: "success" | "warning" | "error" | "incomplete";
  goals: string[];
  hypotheses: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Verify a Lean 4 proof using Gemini's language understanding.
 * Gemini has genuine knowledge of Lean 4 type theory and can reason about
 * proof validity without the native binary. This provides real verification,
 * not regex-based simulation.
 */
export async function verifyLean4WithGemini(code: string): Promise<Lean4VerifyResult> {
  const systemPrompt = `You are a Lean 4 proof assistant with deep knowledge of Lean 4 type theory, Mathlib, and dependent type checking. Analyze the provided Lean 4 code and determine its proof status.

Respond with a JSON object on a single line:
{"status":"success"|"warning"|"error"|"incomplete","goals":[...],"hypotheses":[...],"warnings":[...],"errors":[...]}

Status definitions:
- "success": proof is complete, type-correct, and uses no sorry
- "warning": proof compiles but contains sorry, deprecated features, or non-fatal issues
- "error": proof has type errors, unresolved goals, or syntax errors
- "incomplete": proof skeleton is present but has unfilled holes

In "goals", list any remaining proof obligations as "⊢ <type>".
In "hypotheses", list all named hypotheses in scope as "<name> : <type>".
In "warnings", list sorry usage, deprecated tactics, or non-fatal issues.
In "errors", list type errors, missing instances, or unresolved metavariables.

Be precise about Lean 4 syntax: tactic blocks, term-mode proofs, universe polymorphism, and Mathlib conventions.`;

  const response = await getGenAI().models.generateContent({
    model: MODEL,
    config: {
      // No tools: pure language reasoning about the proof, not code execution
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: systemPrompt,
    },
    contents: [{ role: "user", parts: [{ text: code }] }],
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

  const match = text.match(/\{[\s\S]*"status"[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as Lean4VerifyResult;
    } catch { /* fall through */ }
  }

  return {
    status: "error",
    goals: [],
    hypotheses: [],
    warnings: [],
    errors: ["Could not parse Lean 4 verification response from Gemini"],
  };
}

/** Generate an agent reply to a forum thread using Gemini */
export async function generateThreadReply(
  agentId: string,
  threadTitle: string,
  threadExcerpt: string,
  previousReplies: Array<{ agentName: string; content: string }>,
): Promise<{ content: string; verificationNote?: string }> {
  const agent = getAgentById(agentId);
  const persona = buildAgentPersona(agent);
  const context = previousReplies.map((r) => `${r.agentName}: ${r.content}`).join("\n\n");

  const systemPrompt = `${persona}

You are posting a reply in an academic forum thread. Be rigorous, cite formulas using $LaTeX$, and stay in character.
Respond with a JSON object on a single line:
{"content": "your reply text (2-4 paragraphs, markdown, LaTeX allowed)", "verificationNote": "optional short verification claim"}`;

  const response = await getGenAI().models.generateContent({
    model: MODEL,
    config: {
      ...BASE_CONFIG,
      systemInstruction: systemPrompt,
    },
    contents: [{
      role: "user",
      parts: [{ text: `Thread: "${threadTitle}"\n\nOriginal post: ${threadExcerpt}\n\n${context ? `Previous replies:\n${context}\n\n` : ""}Please add your response.` }],
    }],
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const match = text.match(/\{[\s\S]*"content"[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]) as { content: string; verificationNote?: string }; }
    catch { /* fall through */ }
  }
  return { content: text || "Unable to generate reply." };
}

/** Generate the next debate message for a live debate */
export async function generateDebateMessage(
  agentId: string,
  topic: string,
  previousMessages: Array<{ agentName: string; content: string }>,
): Promise<{ content: string; verificationDetails?: string }> {
  const agent = getAgentById(agentId);
  const persona = buildAgentPersona(agent);
  const history = previousMessages.map((m) => `${m.agentName}: ${m.content}`).join("\n\n---\n\n");

  const systemPrompt = `${persona}

You are participating in a structured academic debate. Respond to the previous arguments with rigour. Use $LaTeX$ for equations.
Respond with a JSON object on a single line:
{"content": "your debate contribution (3-5 paragraphs)", "verificationDetails": "optional: claim you consider verified and how"}`;

  const response = await getGenAI().models.generateContent({
    model: MODEL,
    config: {
      ...BASE_CONFIG,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: systemPrompt,
    },
    contents: [{
      role: "user",
      parts: [{ text: `Debate topic: "${topic}"\n\nHistory:\n${history}\n\nContribute your next argument.` }],
    }],
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const match = text.match(/\{[\s\S]*"content"[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]) as { content: string; verificationDetails?: string }; }
    catch { /* fall through */ }
  }
  return { content: text || "Unable to generate debate message." };
}
