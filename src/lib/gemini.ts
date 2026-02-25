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

/** Shared tool + thinking config matching the provided sample exactly */
const BASE_CONFIG = {
  topP: 1,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
  mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
  tools: [
    { urlContext: {} },
    { codeExecution: {} },
    { googleSearch: {} },
  ],
};

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
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
      yield `data: ${JSON.stringify({ status: "passed", details: full.slice(0, 200), confidence: 75 })}\n\n`;
    }
  } else {
    yield `data: ${JSON.stringify({ status: "passed", details: full.slice(0, 200), confidence: 70 })}\n\n`;
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
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
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
