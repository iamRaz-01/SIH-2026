# AI/ML FEATURE REQUIREMENTS — SIH26103 Infrastructure Predictive Monitoring
## Principal AI/ML Engineer Deliverable

```
Document Status: Draft — AI/ML technical requirements, derived from approved PRD + FRD
Version: v1.0
Scope: F-01 through F-06 (approved MVP). F-07/F-08 excluded — not approved (FRD Open Decision 1).
Timeframe basis: 18-hour build window — ASSUMPTION supplied by request, not confirmed against
                 official SIH schedule (Product_Requirement.md A-004 marks this unresolved).
                 I am using 18 hours as the working constraint per explicit instruction.
```

---

## PRELIMINARY FLAG — BLOCKING DATA RISK (must be surfaced before any AI/ML commitment)

Before mapping features to models, one fact has to be stated plainly: **no model selection in this document can be finalized until OQ-001 (schema continuity) and OQ-002 (project-ID continuity) are resolved**, because they determine OQ-003 (final usable panel size), and panel size determines which validation strategy is even honest to run (true temporal split vs. cross-sectional only).

This is not a formality — it changes which of the two required PS comparisons (baseline-vs-ML, CUF-vs-expanded) are *executable* at all in 18 hours. I've built this document with an explicit fallback path for both dimensions of that risk (Section: AI/ML MVP → Fallback Ladder), and I flag it again in the handoff. This is a **PM-facing feasibility concern under Section 44 of my operating rules**, not something I'm silently working around.

---

## 1. AI/ML FEATURE MAPPING

| Feature | Classification | Reasoning |
|---|---|---|
| F-01 Risk Prediction (Cost & Schedule) | **AI/ML REQUIRED** | Core predictive task — multi-factor, partially-observed outcome. This is the PS's entire ask. |
| F-02 Methodological Accountability | **AI/ML REQUIRED** (as evaluation harness, not a model) | The "AI" here is not a new model — it's the evaluation protocol that scores F-01's models against a baseline and against feature-set variants. Still squarely AI/ML-engineer-owned. |
| F-03 Risk Explanation | **AI/ML REQUIRED** (as a constraint on F-01's model choice, not a separate model) | Explainability is a property F-01's model must have — not an independent ML task. No separate model is trained for this. |
| F-04 Risk Prioritization (Dashboard/Ranked View) | **AI/ML NOT NEEDED** | This is a `sort()` on F-01's output plus state-display logic. Classic AI-washing risk (Role rule §47: DASHBOARD ≠ AI). I own the score it displays, not the sort/display logic itself. |
| F-05 Project Intelligence Retrieval (LLM Q&A) | **AI/ML OPTIONAL** (P1, and I recommend **against** attempting it in 18 hours — see WHAT NOT TO BUILD) | Genuinely an LLM-appropriate task (retrieval-grounded Q&A over structured own-data), but not required to prove the core hypothesis, and carries real hallucination/grounding risk that needs proper evaluation to ship responsibly. |
| F-06 Risk History / Trend Awareness | **AI/ML NOT NEEDED** | Trend display over already-computed F-01 scores across cycles is a data/display operation (delta or slope over a short series), not a modeling task. No new model required. |

**Net result: exactly one genuine ML modeling task exists in the approved MVP (F-01), with F-02 as its mandatory evaluation harness and F-03 as a constraint on which model family is eligible.** Everything else is either not AI/ML, or AI/ML that I'm explicitly recommending be deferred.

---

## 2. AI/ML REQUIREMENTS (per required feature)

### F-01 — Risk Prediction (Cost Overrun)

**ML/AI Objective:** Binary (or ordinal) classification — will this project's cost overrun exceed a defined threshold by [scoring horizon], given its trajectory up to the scoring point?

**Task formulation (Role §9):**
```
x (project feature history up to cycle t) → class (overrun / no-overrun)
```
I am formulating this as **classification**, not regression on overrun magnitude, for one concrete reason: BR-001/BR-002 require a confidence-bearing categorical state (Low/Medium/High Risk + "insufficient data"), and classification produces a calibratable probability directly, whereas a regression-then-threshold approach adds an extra, harder-to-justify calibration step with no evidence it buys anything here. **ASSUMPTION, revisit if PM/architect need a continuous overrun-magnitude estimate.**

**Input:** Project's CUF-derived feature history up to scoring cycle t: sanctioned cost, revised cost (if any), cumulative expenditure, expenditure-vs-cost ratio, physical progress %, milestone status, ministry, sector, project age (cycles since sanction), and — for the CUF-vs-expanded variant only — any supplementary variables the team identifies (**UNKNOWN — data source for "expanded" not yet defined per FRD Open Decision 8; I cannot specify this further until PM/data owner supplies it**).

**Output:** `{risk_class: Low/Medium/High, probability: float, confidence: High/Medium/Low, state: Scored/Insufficient-Data}`

**Data Required:** Team-compiled historical panel, project × cycle granularity, minimum N cycles per project to compute a meaningful trajectory (not just one snapshot).

**Label Required:** Ground-truth "did this project's cost overrun exceed threshold X" — derivable from the panel itself (final/latest revised cost vs. original sanctioned cost), **but only for projects whose trajectory has already resolved (i.e., historical projects with enough elapsed time to know the outcome).** This is a **FACT about label availability, not yet validated against the actual compiled panel** — I have not seen the panel.

**Baseline:** Logistic regression on 3–5 simple engineered features (e.g., expenditure-to-progress ratio, latest cost-revision magnitude, cycles-since-last-milestone). This is the mandatory REQ-P03 comparator — not a placeholder, the actual bar the ML model must clear.

**Recommended Approach:** Gradient-boosted trees (e.g., LightGBM/XGBoost, both open-source) if panel size supports it (rule-of-thumb: comfortably above ~200–300 resolved-outcome examples with reasonable class balance); otherwise fall back to regularized logistic regression as the *final* model, not just the baseline, and say so honestly. **Why not deep learning:** no justification exists — panel is almost certainly small (hundreds, not millions of rows), tabular, and the complexity ladder (Role §17) says move up only when the simpler method fails to satisfy the requirement — nothing here supports jumping straight to DL.

**Why tree-based over pure logistic regression:** trees natively handle non-linear interactions between expenditure ratio and progress ratio without manual feature-crossing, and both LightGBM/XGBoost expose feature-importance/SHAP output directly, satisfying F-03's explainability constraint at no extra engineering cost. Logistic regression is the fallback if the panel is too small to trust the extra tree capacity — I will not choose GBDT if the resolved-outcome sample is small enough that overfitting is the dominant risk; in that case, logistic regression stays as both baseline and final model, and this should be reported plainly.

**Evaluation Metrics:** PR-AUC as primary (class imbalance is likely — most projects don't dramatically overrun; ROC-AUC alone would overstate performance under imbalance), plus Precision/Recall/F1 at the operating threshold actually used for "Flagged for Review," reported alongside a calibration check (reliability curve) because BR-002 requires the confidence number to mean something, not just look like one.

**False-Positive Cost:** Officer attention wasted reviewing a project that wasn't actually heading toward overrun — moderate cost, primarily reviewer-trust erosion (PRD guardrail metric: FP rate).

**False-Negative Cost:** A genuinely at-risk project is not flagged — high cost, directly defeats the product's purpose and is the more serious failure mode of the two; this should bias threshold selection toward recall on known historical overrun cases (PRD guardrail: FN rate on known overruns), not toward maximizing raw accuracy.

**Validation Strategy:** Temporal split — train on earlier cycles/projects, test on later ones. **Not** a random split; a random split here would let information from a project's later (post-outcome) cycles leak into training for that same project's earlier state, which is exactly the leakage BR-004 prohibits. If panel size cannot support a genuine temporal holdout (a live risk — see OQ-003), fall back to a documented cross-sectional split with the limitation stated explicitly, never silently upgraded to "temporal" in reporting.

**Main Risks:**
- Panel size too small for any split to be statistically meaningful (**Unknown, blocking** — depends on OQ-001/002/003).
- Label leakage via "revised cost" fields that were themselves updated *because of* the overrun being visible — this must be checked field-by-field once the panel exists (Role §14 leakage gate).
- Class imbalance if overruns are the minority outcome (likely, given base rates implied by Flash Report figures).
- Schema-boundary features (OCMS vs PAIMANA-era field names/definitions) silently meaning different things across the panel.

**Implementation Complexity:** Medium. The modeling itself (GBDT or logistic regression + SHAP) is a few hours of work *given a clean panel*. The real cost sits upstream in data cleaning, which is outside my role but gates everything I do.

**Hackathon Priority:** P0.

---

### F-01 — Risk Prediction (Schedule/Time Overrun)

Mirrors the cost-overrun formulation exactly (same task type, same baseline, same model family, same validation strategy), with label = milestone/schedule slippage beyond a defined threshold instead of cost. I am not duplicating the full write-up — the only material difference is the target variable and, potentially, which engineered features matter most (progress-rate deceleration vs. expenditure-rate anomalies). Whether cost and schedule risk are modeled as two independent classifiers or one multi-output model is a **decision I will make once I see whether the two labels are highly correlated in the actual panel — UNKNOWN, needs validation on real data, not assumed either way.**

---

### F-02 — Methodological Accountability (Baseline-vs-ML, CUF-vs-Expanded)

**This is not a model — it is the evaluation protocol that makes F-01's outputs credible.** I own it because it requires the same held-out temporal split, the same leakage discipline, and direct comparability of metrics across conditions.

**ML/AI Objective:** N/A (evaluation, not prediction) — produce two honest comparison reports.

**Input:** Trained baseline model, trained ML model (both from F-01), each evaluated on the identical held-out temporal split; separately, CUF-only feature set vs. CUF+expanded feature set, both trained under otherwise-identical conditions.

**Output:** Two structured reports: `{metric_name, baseline_value, ml_value, delta, winner, split_type}` and `{metric_name, cuf_only_value, cuf_expanded_value, delta, winner, coverage_note}`.

**Data Required:** Same panel as F-01. For the CUF-vs-expanded comparison specifically: **the "expanded" feature set is currently undefined (FRD Open Decision 8) — I cannot execute this comparison until PM/data-owner defines what supplementary variables exist and are sourced.** This is a genuine blocker, not something I can substitute a placeholder for, because BR-003 forbids reporting a comparison that isn't real.

**Label Required:** Same as F-01.

**Baseline:** N/A — this feature *is* the baseline comparison mechanism.

**Recommended Approach:** Standard held-out evaluation harness — no novel technique required; the rigor is in discipline (identical split, identical preprocessing, no leakage), not in method sophistication.

**Evaluation Metrics:** Same metric set as F-01 (PR-AUC primary), computed identically for both arms of each comparison so the delta is meaningful.

**False-Positive/Negative Cost:** N/A (not a prediction task).

**Validation Strategy:** Same temporal split as F-01, reused — not a separate split, to keep the comparison apples-to-apples.

**Main Risks:**
- If panel size is small, both comparisons will have wide confidence intervals — I will report this uncertainty explicitly rather than presenting a point estimate as definitive (Role §61, uncertainty protocol).
- CUF-vs-expanded comparison cannot run at all until the expanded feature set exists — **BLOCKING, PM-owned dependency.**
- Temptation to pick a favorable split or threshold post hoc — explicitly disallowed by BR-003; split and threshold must be fixed before looking at test results.

**Implementation Complexity:** Low-Medium (given F-01 exists) for baseline-vs-ML; **unknown/blocked** for CUF-vs-expanded until the data dependency resolves.

**Hackathon Priority:** P0 for baseline-vs-ML. CUF-vs-expanded is P0 **by requirement** but is **at risk of being undeliverable in 18 hours** if the expanded dataset isn't already sourced — flagging this now, not at hour 17.

---

### F-03 — Risk Explanation

**AI/ML angle:** Not a separate model. This is a *constraint* on F-01's model family: the chosen model must support faithful, per-instance factor attribution. Tree-based models (SHAP values) satisfy this directly; a black-box alternative (e.g., a neural net) would require a secondary explanation method (e.g., LIME) that approximates rather than reflects the model's actual reasoning — a strictly weaker, riskier choice with no offsetting benefit here. This is exactly why I ruled out deep learning for F-01 above; F-03's requirement independently reinforces that decision.

**Output for this feature specifically:** top-3 to top-5 SHAP-ranked features per flagged project, mapped to human-readable field names (e.g., "expenditure has outpaced physical progress by 34% over the last 3 cycles" rather than a raw feature name/SHAP value).

**Main Risk:** SHAP explanations are correlational, not causal — FR-03-04 (and my own Role §30 discipline) requires the output to state "contributing factors," never "the cause." This must be enforced in the output template, not left to prompt/UI wording alone.

**Implementation Complexity:** Low, given F-01 uses SHAP-compatible model. **Zero additional model-training cost.**

**Hackathon Priority:** P0 (inherits F-01's priority — it's not separable).

---

## 3. END-TO-END AI/ML FLOW

```
PRODUCT FEATURE: F-01 Risk Prediction (Cost + Schedule)
↓
DATA: Team-compiled CUF-derived panel (project × cycle) — cost, expenditure,
      physical progress %, milestones, ministry, sector, project age
↓
PREPROCESSING: Temporal feature construction (trailing ratios, deltas, rates
      of change up to cycle t) → leakage check (no post-outcome fields) →
      minimum-history gate (BR-001) → train/test temporal split
↓
MODEL: Baseline (logistic regression) AND candidate (GBDT), trained on
      identical splits, twice — once CUF-only, once CUF+expanded
↓
SCORE / OUTPUT: risk_class, probability, confidence, SHAP-based top factors,
      or "insufficient data" state
↓
DECISION (F-02): baseline-vs-ML report + CUF-vs-expanded report, generated
      alongside — both reported as measured, including unfavorable results
↓
DASHBOARD (F-04, non-AI): scores sorted/displayed with state distinctions
↓
USER VALUE: Officer sees a ranked, explainable, evidence-backed early-warning
      list instead of scanning after-the-fact Flash Report tables
```

---

## 4. AI/ML MVP — PRIORITIZED BUILD PLAN

**P0 — MUST BUILD**
- Data leakage audit + temporal train/test split construction (this gates literally everything downstream — build this first, not last).
- Baseline model (logistic regression) — cost overrun.
- Baseline model (logistic regression) — schedule overrun.
- Candidate model (GBDT if panel supports it, else logistic regression stays the final model too) — both targets.
- Confidence/insufficient-data gating logic (BR-001/BR-002).
- SHAP-based per-project factor extraction (F-03).
- Baseline-vs-ML comparison report (F-02, dimension b).

**P1 — SHOULD BUILD**
- CUF-vs-expanded comparison (F-02, dimension c) — **conditional**: only executable once the expanded feature set is actually sourced; if not available by roughly the midpoint of the build window, this should be reported as "CUF-vs-expanded: not evaluable — expanded dataset undefined" rather than skipped silently. That is itself a valid, honest finding, not a failure to hide.
- Calibration check / reliability curve for the confidence indicator.

**P2 — ONLY IF TIME REMAINS**
- Multi-output joint cost+schedule model, if single-target models show the two labels are strongly correlated and a joint model is worth the added complexity.
- F-05 Q&A prototype, narrowly scoped, template-grounded rather than freeform generation (see below).

### Fallback Ladder (for the blocking data risk)

```
IF temporal panel is large & clean (OQ-001/002/003 resolve favorably):
    → GBDT + temporal split + full F-02 comparisons as specified above.

IF panel is small/noisy but schema-consistent:
    → Logistic regression only (as both baseline and final model — report
      this explicitly as a data-driven, not preference-driven, choice) +
      cross-sectional (not temporal) split, clearly labeled as such.

IF panel cannot support ANY credible split (very small, or ID continuity fails):
    → Do not train a model that will overfit and misrepresent performance.
      Report this honestly to PM as an AI FEASIBILITY CONCERN (Role §44) —
      the demo would then show the evaluation *methodology* and *data
      limitations* as the deliverable, not a fabricated high-accuracy number.
      A defensible "we could not yet validate this" beats an indefensible
      99% accuracy claim, especially given the academic literature's own
      overfitting cautionary tale already logged in project context.
```

---

## 5. WHAT NOT TO BUILD (explicit rejections)

- **F-07 Intelligent Anomaly Detection** — not approved (FRD Open Decision 1), and even if it were, it requires its own baseline-history threshold separate from F-01's, doubling data-sufficiency risk in an already data-constrained project. Reject for 18-hour scope regardless of approval status.
- **F-08 Project Network Intelligence** — depends *more* heavily on OQ-001/OQ-002 than F-01 does (false project-identity duplication directly produces false relationships). Building this before project-identity continuity is validated would risk shipping a feature built on a known-unreliable foundation. Reject for 18-hour scope.
- **Deep learning of any kind for F-01** — no evidence the panel size justifies it; would consume build time on architecture/tuning that a GBDT gets essentially for free, and would break F-03's explainability requirement without a compensating benefit. Reject.
- **Freeform generative Q&A (F-05) without strict grounding** — if attempted at all (P2 only), it must be template/retrieval-constrained against the system's own structured output (scores, SHAP factors, comparison reports), not an open-ended LLM chat over raw data, given zero time budget in 18 hours to properly evaluate hallucination rate. Recommend deferring entirely; if built, scope it to answering from a fixed set of pre-computed fields only, with explicit "cannot answer" fallback (FR-05-04).
- **Any model claiming a specific accuracy figure before the panel is inspected** — explicitly rejecting the temptation to pre-commit to a target number; Section 41 (Model Claim Discipline) applies directly here, and the academic literature's ~99.7% figure is a documented cautionary example already in project context, not one to repeat.
- **A single joint "risk score" merging cost and schedule risk into one number** — not requested by the PRD (which separately requires REQ-P01 and REQ-P02), and would obscure which type of risk is driving a flag, weakening F-03's explainability requirement. Reject unless PM explicitly requests it.

---

## 6. HANDOFF TO ARCHITECT

```
AI/ML INPUTS:
Project × cycle records from the compiled historical panel: cost, revised
cost, cumulative expenditure, physical progress %, milestone/schedule
status, ministry, sector, project age, sanctioned-cost band. Two feature-set
variants required (CUF-only, CUF+expanded) — expanded set schema is
currently undefined and is a pending upstream data dependency, not an
architecture concern.

AI/ML OUTPUTS:
Per project, per cycle:
  { project_id, cost_risk_class, cost_probability, cost_confidence,
    schedule_risk_class, schedule_probability, schedule_confidence,
    state: "Scored" | "Insufficient Data",
    top_factors: [ {field, direction, magnitude_desc} ] }
Plus, per training run (not per cycle):
  { comparison_type: "baseline_vs_ml" | "cuf_vs_expanded",
    metric_name, arm_a_value, arm_b_value, delta, winner, split_type,
    notes_on_limitations }

INFERENCE MODE:
Batch, not real-time. Scoring runs once per monthly data cycle, matching
the CUF submission cadence (PRD §23) — there is no interactive/low-latency
requirement anywhere in F-01–F-06. Do not provision for real-time inference.

LATENCY EXPECTATIONS:
Not a constraint at MVP scale (~1,981 projects, monthly batch). A single
batch scoring run over the full portfolio should complete in low minutes on
commodity hardware for a GBDT/logistic-regression model of this size —
order-of-magnitude estimate, not benchmarked.

MODEL/SERVICE INTERFACE:
A simple synchronous function/service call is sufficient: given a project's
feature history, return the output schema above. No streaming, no
session/conversation state required (F-05, if built, is stateless per query
per FRD).

DEPENDENCIES:
- Clean, schema-consistent historical panel (OQ-001, OQ-002) — blocking,
  owned upstream of AI/ML, not something the architecture can route around.
- Expanded feature dataset definition (FRD Open Decision 8) — blocking for
  F-02's second comparison only, not for F-01/F-03 core scoring.
- No external API/live dependency — confirmed already excluded (DEC-003).

FAILURE BEHAVIOR:
- Insufficient history → return "Insufficient Data" state, never a score
  (BR-001). Architecture should treat this as a valid, expected response
  state, not an error.
- Missing/malformed cycle input → exclude that project from that cycle's
  run; prior valid score/timestamp should be retained by the system, not
  recomputed or blanked (this is a state-management concern for
  Architecture, not something the model itself handles).
- Model/explanation mismatch (explanation cannot be generated for a scored
  project) → should not occur given the SHAP-compatible model choice, but
  if it does, return "explanation unavailable" rather than a bare score,
  per F-03's failure rule.

DEPLOYMENT REQUIREMENTS:
Lightweight — open-source Python stack (scikit-learn for baseline,
LightGBM/XGBoost for candidate model, SHAP for explanation), no GPU
requirement, no specialized serving infrastructure needed at this data
volume. Model artifacts (trained weights + fixed feature schema + fixed
decision threshold) should be versioned as a unit so a given month's
dashboard output is always traceable to the exact model version that
produced it — this matters for BR-003 auditability, not just engineering
hygiene.
```

---

## SUMMARY VERDICT

**AI Necessity:** Required — for exactly one task (F-01 risk classification), evaluated by one mandatory harness (F-02). Everything else in the approved MVP is either display logic or out of AI/ML's scope entirely.

**Highest-risk assumption carried into this document:** that the compiled historical panel will actually support a temporal split with a meaningful resolved-outcome sample size. I cannot resolve this — it is upstream of my role. **PRODUCTION VALIDATION REQUIRED before any specific performance number is claimed in a demo.**

**Recommendation:** Approve F-01/F-02/F-03 as specified, with the fallback ladder pre-agreed now (not improvised at hour 16) so that whichever branch the data turns out to support, the team already knows what "done" looks like.
