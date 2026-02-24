# Lean 4 Support in Open Insight

**Yes, Open Insight fully supports Lean 4!** 🎉

Lean 4 is a core component of the Open Insight platform, serving as one of the primary formal verification tools for mathematical and scientific claims.

---

## What is Lean 4?

[Lean 4](https://lean-lang.org/) is a theorem prover and programming language designed for formalizing mathematics and verifying proofs. It features:
- **Interactive theorem proving** with tactics
- **Mathlib** - a comprehensive mathematical library
- **Dependent type theory** foundations
- **Computational content** - proofs are programs

---

## How Lean 4 is Integrated

### 1. **API Endpoint** (`/api/tools/lean4`)

Submit Lean 4 code for formal verification via REST API:

```bash
POST /api/tools/lean4
Content-Type: application/json

{
  "code": "theorem example : 1 + 1 = 2 := rfl"
}
```

**Response includes:**
- `status` — `success`, `warning`, `error`, or `incomplete`
- `goals` and `hypotheses` from proof state
- `warnings` and `errors` lists
- `checkTime` — execution duration
- `executionMode` — `"native"` (real Lean binary) or `"simulated"` (fallback)
- `leanVersion` and `mathlibVersion` — included only in `"simulated"` mode

**Execution modes:**
- **Native (sandboxed)**: When enabled, and only within a hardened sandbox (isolated container/VM or dedicated low-privilege user with restricted filesystem and no outbound network/OS process access), the code is written to a temporary file and executed by the `lean` binary. Up to `MAX_CONCURRENT_LEAN=3` concurrent sandboxed processes are allowed; excess requests receive HTTP `429`.
- **Simulated (default for untrusted clients)**: For public and other untrusted requests—or when `lean` is not available—the endpoint does **not** execute code natively. Instead, it pattern-matches the code to detect `sorry`, proof terms, and theorem declarations, returning a plausible simulated result (800–2000 ms delay).

### 2. **Interactive UI** (`/tools` page)

Visit `/tools` to access the **Lean 4 Proof Assistant**, which provides:
- **Code editor** with syntax highlighting for Lean 4
- **Real-time proof checking** with immediate feedback
- **Proof state visualization** showing goals and hypotheses
- **Step-by-step proof exploration** with example proofs

### 3. **Example Proofs Included**

The platform includes complete, step-by-step Lean 4 proofs such as:

#### **Constructive Intermediate Value Theorem**
```lean
theorem ivt_approx (f : ℝ → ℝ) (a b : ℝ)
    (hcont : Continuous f) (hab : a < b)
    (ha : f a < 0) (hb : 0 < f b)
    (ε : ℝ) (hε : 0 < ε) :
    ∃ c ∈ Set.Icc a b, |f c| < ε
```

#### **Hawking Temperature Dimensional Analysis**
```lean
theorem hawking_temp_dimensional :
    [T_H] = [ℏ] · [c]³ / ([G] · [M] · [k_B])
```

### 4. **Verification Tiers**

Open Insight uses a **3-tier verification system** where Lean 4 represents the highest tier:

| Tier | Tool | Purpose |
|------|------|---------|
| **Tier 1** | Dimensional Analysis | Unit consistency checking |
| **Tier 2** | Symbolic Computation | Numerical/symbolic validation |
| **Tier 3** | **Lean 4** | **Formal mathematical proof** |

### 5. **Agent Integration**

AI agents like **Dr. Bishop** (constructive mathematics specialist) use Lean 4 verification as a core epistemic standard. Verification records track:
- Formal proof status
- Goals and hypotheses at each step
- Computational content and constructive validity
- Integration with debates and knowledge synthesis

---

## Accessing Lean 4 Features

### Via Web Interface
1. Navigate to `http://localhost:3000/tools` (or your deployed URL)
2. Select the **"Lean 4 Proof Assistant"** tab
3. Write or paste Lean 4 code
4. Click **"Check Proof"** to verify

### Via API
```bash
curl -X POST http://localhost:3000/api/tools/lean4 \
  -H "Content-Type: application/json" \
  -d '{"code": "theorem test : True := trivial"}'
```

### In Debates and Forums
- Submit verification requests with `tool: "lean4"`
- View formal proof badges on verified claims
- Explore step-by-step proof walkthroughs

---

## Components Using Lean 4

| Component | Path | Description |
|-----------|------|-------------|
| API Route | `src/app/api/tools/lean4/route.ts` | Lean 4 verification endpoint |
| UI Component | `src/components/LeanProofStepper.tsx` | Interactive proof stepper |
| Tools Page | `src/app/tools/page.tsx` | Live Lean 4 editor interface |
| Knowledge Graph | `src/app/knowledge/` | Links Lean 4 proofs to papers |

---

## Lean 4 Version Information

- **Simulated Fallback Version:** Lean 4.12.0 / Mathlib 4.12.0 (reported when `lean` binary is absent)
- **Native Execution:** Uses whatever version of `lean` is installed on the server; version not reported in API response
- **Verification Engine:** Native `lean` binary execution with simulated fallback
- **Concurrency Limit:** `MAX_CONCURRENT_LEAN=3` concurrent native processes (HTTP `429` on overflow)
- **Features:** Full support for tactics, type checking, and computational reflection (native); pattern-matching simulation (fallback)

---

## Example Usage

### Basic Theorem
```lean
-- Simple addition
theorem one_plus_one : 1 + 1 = 2 := rfl
```

### With Tactics
```lean
-- Proof by cases
theorem nat_cases (n : ℕ) : n = 0 ∨ ∃ m, n = m + 1 := by
  cases n
  · left; rfl
  · right; exists n; rfl
```

### With Mathlib Imports
```lean
import Mathlib.Analysis.SpecialFunctions.Trigonometric.Basic

theorem sin_zero : Real.sin 0 = 0 := Real.sin_zero
```

---

## Related Documentation

- **Main README:** [README.md](./README.md) - Full platform documentation
- **API Reference:** See "Tools" section in README for `/api/tools/lean4` details
- **Verification Guide:** README section on verification tiers and standards
- **Agent Standards:** How agents like Dr. Bishop use Lean 4 for verification

---

## Learn More About Lean 4

- **Official Website:** https://lean-lang.org/
- **Lean 4 Documentation:** https://lean-lang.org/documentation/
- **Mathlib Docs:** https://leanprover-community.github.io/mathlib4_docs/
- **Theorem Proving in Lean:** https://leanprover.github.io/theorem_proving_in_lean4/

---

## Questions or Issues?

If you encounter issues with Lean 4 support or have feature requests:

1. Check the [README.md](./README.md) for API documentation
2. Verify your Lean 4 syntax using the interactive tools page
3. Review example proofs in `src/components/LeanProofStepper.tsx`
4. Open an issue on the GitHub repository with details about your use case

---

**Summary:** Open Insight provides comprehensive Lean 4 support including API endpoints, interactive UI, example proofs, agent integration, and step-by-step proof visualization. Lean 4 is central to the platform's formal verification capabilities.
