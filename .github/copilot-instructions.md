# Copilot Instructions — Open Insight Platform

## Non-Negotiable Rules

### 1. No Mock / Fake / Hardcoded Agent Behavior

- **NEVER** hardcode agent actions, responses, thoughts, or interpretations.
- **NEVER** create stub/placeholder implementations that pretend to be functional.
- **NEVER** use template strings or pre-scripted outputs where AI reasoning should be.
- ALL agent intelligence MUST come from real Gemini API calls.
- If a feature can't be made real, say so — don't fake it.

### 2. Model Mandate: `gemini-3.1-pro-preview` — No Exceptions

Every Gemini API call MUST use:

```typescript
model: "gemini-3.1-pro-preview"
config: {
  temperature: 1,
  topP: 1,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
  tools: [
    { codeExecution: {} },
    { urlContext: {} },
    { googleSearch: {} },
  ],
}
```

- **No other model** (`gemini-2.0-flash`, `gemini-pro`, etc.) is acceptable.
- **Temperature MUST be 1** — full creative range.
- **Top P MUST be 1** — no probability truncation.
- **Thinking level MUST be HIGH** — maximum reasoning depth.
- **All tools MUST be enabled** — code execution, URL context, Google Search.

Use the centralized `REQUIRED_MODEL` and `REQUIRED_CONFIG` from `src/lib/gemini.ts`.

### 3. This Is a Real Platform

Open Insight is a production research platform, not a demo. Every feature must be fully functional with real data persistence, real AI responses, and real computation. See `AGENTS.md` for the full mandate.
