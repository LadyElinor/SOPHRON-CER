# ARXIV_RESEARCH_GUIDE.md
SOPHRON-CER Research Integration Guide  
Version: 0.1 (Feb 10, 2026)  
Purpose: Map pipeline components to 2025–2026 arXiv literature. Provide validation paths, upgrade priorities, and ready-to-use search/code patterns.

## 0) Canonical paper/title corrections (use these strings)
- **arXiv:2406.00799** — **“Get my drift? Catching LLM Task Drift with Activation Deltas”** (canonical title on arXiv as of Feb 2026)

## 1) Component-to-Research Mapping

### 1.1 Proxy Detection (token-promo, outbound pressure, safety/eng language, etc.)
- **Current**: 5 regex-based proxies
- **Target upgrade**: taxonomy-driven proxies + lightweight classifiers (toxicity/jailbreak patterns)
- **Key paper**:
  - [arXiv:2508.05775](https://arxiv.org/abs/2508.05775) — “Guardians and Offenders: A Survey on Harmful Content Generation and Safety Mitigation of LLM” (Chi Zhang et al., Aug 2025)
    - Use: unified taxonomy of harms/defenses (toxicity, jailbreaks, multimodal) → expand/validate proxy set.
- **Datasets (for proxy tests / regression suites)**:
  - HarmfulQA, ToxiGen, AdvBench (and any datasets referenced by the survey above)
- **Operator actions**:
  - Extract taxonomy categories → map each category to:
    - (a) a proxy tag name
    - (b) a minimal regex / heuristic v0
    - (c) an eval dataset slice + expected behaviors
  - Replace/augment regex-only proxies with taxonomy-aligned patterns or a small classifier.

### 1.2 Drift Detection (baseline vs safety-intervened cohort shifts)
- **Current**: KL divergence; embedding distance on outputs
- **Target upgrade**: activation deltas for internal/task drift (more robust to surface confounders)
- **Key paper**:
  - [arXiv:2406.00799](https://arxiv.org/abs/2406.00799) — “Get my drift? Catching LLM Task Drift with Activation Deltas” (Sahar Abdelnabi et al., Jun 2024 → Mar 2025)
    - Use: linear probe on hidden-state deltas for drift/jailbreak/prompt-injection style attacks.
- **Operator actions**:
  - If you can log activations: prototype an `ActivationDriftDetector` (probe-on-deltas).
  - If you cannot log activations in prod: use open-weight proxy models to validate feasibility + calibrate expected effect sizes.

### 1.3 Alignment Signals (SHIFT/GAME/DECEPT/CORRIG/HUMAN, etc.)
- **Current**: keyword/pattern tags
- **Target upgrade**: multi-context consistency checks; capability probes; AUQ-style (alignment uncertainty) flags
- **Key paper**:
  - [arXiv:2507.19672](https://arxiv.org/abs/2507.19672) — “Alignment and Safety in Large Language Models: Safety Mechanisms, Training Paradigms, and Emerging Challenges” (Haoran Lu et al., Jul 2025)
    - Use: map each tag family to a known failure mode / training paradigm; add “consistency across contexts” checks.
- **Operator actions**:
  - Build a mapping table: `tag → paradigm/failure-mode → test prompt family → expected safe behavior`.
  - Add cross-cohort consistency checks:
    - same prompt, baseline vs safety cohort
    - same prompt, different wrappers / paraphrases
    - same prompt, different retrieval contexts (if applicable)

### 1.4 Statistical Methods (prevalence, CIs, effect sizes, tests)
- **Current**: Wilson CI, Cohen’s h, χ²/Fisher, Mann–Kendall, weighted metrics
- **Target upgrade**: multiple-testing correction on “many tags × many slices × many time windows”
- **Operator actions**:
  - Implement Benjamini–Hochberg FDR correction on tag-level p-values (per analysis block) to cap false discoveries.
  - Emit “receipts”:
    - raw p-values
    - adjusted q-values
    - the rejection set
    - the analysis family definition (“what counts as a family of tests?”)

### 1.5 Privacy & Redaction
- **Current**: regex PII + k-anonymity threshold
- **Target upgrade**: NER-based detection (spaCy/flair/etc.) + DP noise for sensitive aggregates
- **Operator actions**:
  - Add NER stage (even if optional/off-by-default): compare against regex-only recall/precision.
  - Add DP option for aggregate prevalence:
    - Laplace/Gaussian noise on counts or rates
    - document ε/δ + composition assumptions

### 1.6 Evaluation & Broader Safety Context
- **Safety evaluation taxonomy**:
  - [arXiv:2506.11094](https://arxiv.org/abs/2506.11094) — “The Scales of Justitia: A Comprehensive Survey on Safety Evaluation of LLMs” (v2 Oct 2025)
    - Use: benchmark coverage gaps via a Why/What/Where/How framing.
- **What matters empirically (alignment factors + attacks)**:
  - [arXiv:2601.03868](https://arxiv.org/abs/2601.03868) — “What Matters For Safety Alignment?” (Jan 2026)
    - Use: prioritize tests around known high-leverage attack classes (roleplay, prompt injection, prefix/CoT attacks).

## 2) Research-Driven Roadmap (Operator Checklist)

### Phase 1 — Immediate (1–3 days)
- [ ] Read abstracts + skim PDFs of the 5 papers above.
- [ ] Cross-validate current proxy taxonomy against [arXiv:2508.05775](https://arxiv.org/abs/2508.05775).
- [ ] Identify whether activation logging is feasible anywhere in the pipeline (prod, staging, open-model proxy).
- [ ] Define “analysis families” for multiple-testing correction (e.g., per run; per day; per tag-pack).

### Phase 2 — Short-term (1–2 weeks)
- [ ] Prototype activation-delta drift probe (open-model proxy if needed).
- [ ] Replace/augment regex proxies with taxonomy-derived heuristics + NER (optional).
- [ ] Add jailbreak/roleplay detection patterns (AdvBench-style prompts + defenses).
- [ ] Implement Benjamini–Hochberg FDR correction in the stats analyzer.

### Phase 3 — Medium-term (3–4 weeks)
- [ ] Integrate DP noise option on cohort prevalences (document parameters, output both raw+noised where safe).
- [ ] Add causal-inference hooks for intervention effects (only if you have controllable interventions / sim data).
- [ ] Run validation against known benchmarks (ToxiGen, HarmfulQA, AdvBench) and store receipts.

## 3) Ready-to-Use arXiv Search Workflows

### Category targets
- cs.CL (LLM/content moderation/safety proxies)
- cs.LG (monitoring/drift/statistics)
- cs.AI (alignment mechanisms)
- cs.CY (ethics/societal impacts)
- cs.CR (privacy/DP/security)

### Base queries (add freshness filters like `since:2025` when supported)
- Drift:
  - `("concept drift" OR "covariate shift" OR "task drift") AND (LLM OR "large language model")`
- Alignment failure modes:
  - `("reward misspecification" OR "specification gaming" OR "deceptive alignment") AND (LLM OR "large language model")`
- Proxies/harms/moderation:
  - `("toxicity detection" OR "content moderation" OR jailbreak OR "prompt injection") AND (LLM OR "large language model")`
- Stats / multiple testing:
  - `("false discovery rate" OR "multiple testing" OR "effect size") AND (monitoring OR evaluation)`
- Eval/benchmarks:
  - `("safety evaluation" OR benchmark OR taxonomy) AND (LLM OR "large language model")`

## 4) Code Patterns (Research-Backed Snippets)

### 4.1 Activation drift (from arXiv:2406.00799)
```js
// PSEUDO-CODE (operator sketch)
// delta = hidden_after - hidden_before
// score = linear_probe.predict_proba(delta)
// if score > threshold: flag as drift / injection-like behavior
```

### 4.2 FDR correction (Benjamini–Hochberg)
```js
// PSEUDO-CODE
// Input: p[1..m]
// Sort ascending: p(1) <= p(2) <= ... <= p(m)
// Find largest k s.t. p(k) <= (k/m) * Q   (Q = target FDR, e.g., 0.05)
// Reject H0 for tests 1..k; report q-values.
```

### 4.3 NER PII upgrade
- Start with “shadow mode”:
  - run regex redaction + NER redaction in parallel
  - compare deltas in:
    - PII hit rate
    - false positives (over-redaction)
    - downstream metric stability

---
Living document: expand as new papers drop; keep edits small and receipted (add paper IDs + what changed operationally).
