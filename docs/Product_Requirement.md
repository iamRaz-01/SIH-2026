# PRODUCT REQUIREMENTS DOCUMENT

## 1. Document Control

```text
Product Name: Working name "InfraGuard AI" (DECISION status: proposed only, not formally approved by team lead — carry forward as-is)
Document Status: Draft — Baseline Product Truth (pending human/team-lead approval)
Version: v1.0
Date: 2026-08-30
Product Owner: Principal Product Manager (this role)
Source Problem Statement: SIH26103 — "Use case on web-based integrated project-monitoring platform," MoSPI / DIID
Scope: Central Sector infrastructure projects (₹150 Cr+) tracked on PAIMANA/OCMS; predictive/prescriptive risk layer only
Last Major Decision: APPROVE WITH CONDITIONS (prior PM analysis) — conditions not yet resolved (see Section 26, Open Questions)
```

**Note on approval status:** This document is not yet "APPROVED" per Section 45's rule — it is the baseline Product Truth pending human team-lead sign-off and pending resolution of the data-continuity conditions already identified (OQ-001/OQ-002). Downstream agents should treat it as authoritative for *direction*, while treating the MVP's exact feasibility as conditional until those questions resolve.

---

## 2. Executive Product Summary

**Problem:** MoSPI's PAIMANA/OCMS system monitors ~1,981 Central Sector infrastructure projects (~₹42.78 lakh crore) but is purely descriptive — it reports cost, expenditure, and schedule status only after the fact. No forward-looking signal exists to flag a project's overrun/delay risk before it appears in the monthly numbers.

**User:** The IPMD/MoSPI monitoring officer who reviews the portfolio monthly, with PMG and PRAGATI as the downstream bodies that act on escalated risk.

**Product:** A decision-support layer that scores each project's cost- and schedule-overrun risk from historical CUF-derived data, explains why a project is flagged, ranks the portfolio by risk, and rigorously reports whether prediction/AI actually outperforms a simple baseline and whether current CUF fields are sufficient to predict risk at all.

**Value:** Converts monthly review from "scan tables for what's already visible" to "start from a ranked, explainable, evidence-backed list of what's likely to go wrong."

**MVP:** Risk prediction (cost + schedule) with confidence indication, per-project explanation, portfolio ranking, and the two PS-mandated methodological comparisons (baseline-vs-ML, CUF-vs-expanded), reported honestly regardless of outcome.

**Expected Outcome:** A monitoring officer can identify at-risk projects earlier than descriptive reporting alone allows, with a defensible basis for the claim — not a bare score.

---

## 3. Problem Definition

**Problem Statement (preserved, not paraphrased into a different claim):** PAIMANA/OCMS provides robust descriptive monitoring but no predictive/prescriptive layer; the PS asks for an AI-powered Predictive Analytics and Early Warning System to identify cost escalation, schedule delay, and implementation risk before it materializes.

**Problem Context:** 17 ministries, 22 sectors, monthly CUF submission cycle, increasingly API-fed ingestion (~64% for select ministries), periodic PRAGATI/PMG review of escalated cases.

**Current State:** PIA submits monthly CUF data → OCMS/PAIMANA aggregation → Flash Report/dashboard generation → PRAGATI/PMG review of what is already visibly delayed/overrun.

**Pain Points:** No systematic forward-risk ranking across ~1,981 projects; review capacity is spent reactively; root causes (land, clearance, financing) are largely outside what CUF fields directly capture, so even the descriptive data under-explains *why* a project is drifting.

**Consequences (FACT):** Recurring multi-lakh-crore overruns across nearly every published monthly report over roughly a decade — a structural, not episodic, pattern.

**Root Cause:** Structural gap between what is tracked (financial/progress consequences) and what predicts failure (administrative/coordination drivers), compounded by a periodic rather than risk-prioritized review cadence. **INFERENCE, well-evidenced — not independently proven on this specific dataset. ROOT CAUSE NOT FULLY VALIDATED at the predictive-magnitude level; this is precisely what PS dimension (c) requires the team to test.**

---

## 4. User Definition

**Primary User:** IPMD/MoSPI monitoring officer — reviews the portfolio monthly, has no current forward-risk tool.

**Secondary Users:** Line-ministry/PIA staff (monthly CUF data submitters); their workflow is not changed by this product, but their submitted data is its sole input.

**Decision Makers:** PMG (cross-agency escalation body) and PRAGATI (PMO-level review) — they decide which flagged projects receive intervention/resources. MoSPI/DIID (PS issuer) is the decision-maker for whether the product's methodology is credible enough to matter.

**Beneficiaries:** Citizens who depend on timely delivery of the monitored infrastructure. **INFERENCE — standard downstream reasoning, not PS-stated.**

No additional personas are introduced beyond what the problem and prior analysis established.

---

## 5. User Jobs

```text
Job 1
Situation: Reviewing the monthly project portfolio.
User Goal: Identify which projects are trending toward cost or schedule overrun.
Current Method: Manually/heuristically scan Flash Report tables and dashboards for visible variance.
Pain: No forward signal; only after-the-fact numbers are visible.
Desired Outcome: A prioritized list of at-risk projects, ahead of visible variance.

Job 2
Situation: A project is flagged as at-risk.
User Goal: Understand why, well enough to act or escalate credibly.
Current Method: No equivalent capability exists today.
Pain: A bare score cannot be defended to PMG/PRAGATI.
Desired Outcome: Plain-language contributing factors behind the flag.

Job 3
Situation: Deciding whether to trust the system at all.
User Goal: Know whether prediction/AI actually beats reading the reports manually.
Current Method: No comparison currently exists.
Pain: No evidence either way.
Desired Outcome: An honest, evidence-based comparison against a defined baseline.

Job 4
Situation: Evaluating the monitoring framework itself (MoSPI/DIID perspective).
User Goal: Know whether currently-collected CUF fields are sufficient for prediction, or whether data collection needs to change.
Current Method: No comparison currently exists.
Pain: Unknown whether CUF is structurally adequate.
Desired Outcome: An honest finding, in either direction.
```

---

## 6. Current User Journey

```text
TRIGGER: Monthly CUF submission deadline
↓
USER ACTION: PIA submits cost/expenditure/progress data → OCMS/PAIMANA (~64% API-fed for select ministries)
↓
CURRENT PROCESS: Aggregation → Flash Report generation → dashboards (165-indicator NIPFP framework)
↓
DECISION: PMG/PRAGATI review already-visible delays/overruns on a periodic cadence
↓
OUTCOME: Escalation happens only after variance is already materially large
```

**Where the actual inefficiency is:** Not data capture (reasonably mature) and not the existence of review bodies (PMG/PRAGATI already function). The gap is specifically the absence of a forward-looking ranking signal feeding into those existing cycles.

---

## 7. Product Opportunity

**Opportunity:** Insert a risk-scoring step between monthly CUF ingestion and PMG/PRAGATI review, so review bodies triage by predicted risk rather than only already-visible variance.

**Desired Future State:** A project trending toward overrun is flagged and explained before its variance is large enough to be visible in standard reporting.

**Value Creation:** The product does not replace CUF submission or PRAGATI/PMG. It converts existing monthly CUF data into a per-project risk score plus explanation, ranked, ahead of/alongside the review cycle.

**Product Opportunity Statement:** By scoring and explaining project risk from data MoSPI already collects, the product removes the "manually scan tables for who's in trouble" step and replaces it with a prioritized, evidence-backed starting point for review.

---

## 8. Product Hypothesis

```text
We believe that IPMD/MoSPI monitoring officers and PMG/PRAGATI reviewers
experience delayed visibility into which projects are heading toward cost/schedule overrun,

because the monitoring system captures financial/progress consequences rather
than forward-looking risk signals, and review is periodic rather than risk-prioritized.

If we provide a per-project, explainable risk score and ranked early-warning list
derived from historical CUF-pattern trends,

then reviewers should be able to identify at-risk projects earlier than the point
at which the overrun/delay becomes visible in current descriptive reporting.

We will know this is working when a model trained on the team's historical panel
achieves better-than-baseline performance on a held-out temporal split, and the
CUF-vs-expanded-features comparison yields a clear, honestly-reported finding.
```

**Key assumptions behind this hypothesis (ranked by impact × uncertainty):**
1. OCMS→PAIMANA schema continuity holds well enough to build a consistent panel (Critical, unresolved).
2. Project identity is trackable across years (Critical, unresolved).
3. The resulting panel is large enough for a genuine train/test split (High, dependent on 1–2).
4. CUF fields carry meaningful predictive signal at all (Medium — if not, the product's honest finding shifts toward "CUF is insufficient," which is still a valid deliverable, not a failure).

---

## 9. Product Vision

**Product Vision (longer-term, not MVP):** A standing decision-support layer that MoSPI/IPMD could plausibly integrate into the PAIMANA review cycle, potentially informing future CUF schema revisions based on the CUF-sufficiency finding this product is designed to produce.

**MVP (now):** See Section 15.

**Future (explicitly not now):** Cross-project benchmarking/comparative analytics as a standalone module; portfolio-level driver aggregation distinct from per-project explanation; deeper trend/history views; broader Q&A beyond the system's own predictions.

Future vision does not inflate MVP scope — see Section 29 (Out of Scope).

---

## 10. Value Proposition

```text
For the IPMD/MoSPI monitoring officer
who currently sees project risk only after it is visible in monthly reported variance,
our product provides an explainable, ranked risk-prediction layer
by scoring cost- and schedule-overrun risk from existing CUF-derived data and honestly
comparing that prediction against a simple baseline and against current data-field sufficiency,
resulting in earlier, evidence-backed prioritization of which projects need attention.
```

The value proposition is not "we use AI" — it is earlier, explainable, evidence-backed prioritization.

---

## 11. Product Principles

- Every risk score must be accompanied by a confidence/data-sufficiency indication — a score presented without basis is worse than no score.
- Every flagged project must have a plain-language explanation — no black-box output.
- Both mandated comparisons (baseline-vs-ML, CUF-vs-expanded) must be reported as found, including unfavorable results — no suppression or reframing.
- The product is decision-support only — it does not take action, approve, escalate, or override; PMG/PRAGATI retain all decision authority.
- Prefer the smallest coherent panel that is schema-consistent over a longer but structurally uncertain one.

---

## 12. Product Capabilities

```text
Capability: Risk Prediction
Purpose: Score each project's likelihood of cost/schedule overrun
User Need: Job 1
Problem Addressed: No forward-looking signal exists
Expected Outcome: A numeric/categorical risk assessment per project, per cycle
Priority: P0

Capability: Risk Explanation
Purpose: Show why a project was flagged
User Need: Job 2
Problem Addressed: Black-box scores are not actionable or defensible
Expected Outcome: Plain-language contributing factors per flagged project
Priority: P0

Capability: Risk Prioritization
Purpose: Rank/surface the projects that matter most across ~1,981 projects
User Need: Job 1
Problem Addressed: Manual review doesn't scale to portfolio size
Expected Outcome: A ranked, navigable view distinguishing flagged / low-risk / not-yet-scorable
Priority: P0

Capability: Methodological Accountability
Purpose: Prove whether prediction/AI helps and whether CUF fields are sufficient
User Need: Job 3, Job 4
Problem Addressed: PS dimensions (b) and (c) are explicit, unanswered requirements
Expected Outcome: Two honestly-reported comparisons
Priority: P0

Capability: Project Intelligence Retrieval
Purpose: Let a user ask plain-language questions about a project's data/prediction
User Need: Job 2 (extended)
Problem Addressed: Static displays are hard to interrogate
Expected Outcome: Conversational access to the system's own predictions/data
Priority: P1

Capability: Risk History / Trend Awareness
Purpose: Show whether a project's risk is worsening, stable, or improving over cycles
User Need: Job 1 (extended)
Problem Addressed: Point-in-time scores don't convey trajectory
Expected Outcome: Trend view across recent cycles
Priority: P1
```

---

## 13. Conceptual Feature Architecture

```text
CAPABILITY: Risk Prediction
├── Assess cost-overrun risk for a project
├── Assess schedule/time-overrun risk for a project
└── Indicate confidence / data-sufficiency for a given assessment

CAPABILITY: Risk Explanation
├── Show top contributing factors behind a risk flag
├── Present factors in plain, non-technical language
└── Show which data fields drove the assessment

CAPABILITY: Risk Prioritization
├── Rank projects by risk severity
├── Distinguish flagged / not-yet-scorable / low-risk states
└── Filter/narrow the ranked view by ministry or sector

CAPABILITY: Methodological Accountability
├── Compare prediction-based approach against a simple baseline method
├── Compare predictions using CUF-only fields vs. additional variables
└── Report both comparisons honestly, including unfavorable findings

CAPABILITY: Project Intelligence Retrieval
├── Answer plain-language questions about a specific project's data/prediction
└── Summarize why a set of projects were flagged together

CAPABILITY: Risk History / Trend Awareness
├── Show how a project's risk assessment has changed across recent cycles
└── Indicate whether a previously-flagged project's situation has changed
```

Each feature's purpose/user value/problem/capability/priority is detailed fully in Section 22 (P0 set) and the prior Conceptual Feature Architecture handoff; not restated here to avoid duplication.

---

## 14. Feature Prioritization

**P0 — MUST HAVE**
- Assess cost/schedule overrun risk — without it, there is no predictive product.
- Confidence/data-sufficiency indicator — without it, unreliable scores could be presented as trustworthy.
- Show contributing factors — without it, a score is unusable by a policy reviewer.
- Rank projects by risk / status states — without it, individual scores don't solve the "where do I look first" problem.
- Baseline-vs-prediction comparison, honestly reported — explicit PS requirement (dimension b).
- CUF-only vs expanded comparison, honestly reported — explicit PS requirement (dimension c).

**P1 — IMPORTANT**
- Plain-language project Q&A (PS-named outcome h) — reinforces explainability; product still proves its hypothesis without it.
- Filter by ministry/sector — improves usability at scale; not required to demonstrate core capability.
- Risk trend over time — strengthens the early-warning narrative; not required for the base loop.

**P2 — OPTIONAL**
- Summarize a flagged-project set.
- Indicate change since last flag (redundant with trend view at P1).

**FUTURE**
- Cross-project benchmarking/comparative analytics module.
- Portfolio-level cost-escalation driver aggregation, distinct from per-project explanation.
- Full historical multi-decade trend exploration beyond the validated panel.

---

## 15. MVP Definition

**MVP Inclusions:**
- Cost- and schedule-overrun risk scoring per project, with confidence/data-sufficiency indication.
- Per-project explanation (top contributing factors, plain language).
- Portfolio-wide risk ranking with flagged/low-risk/not-yet-scorable states.
- Baseline-vs-prediction comparison, reported as found.
- CUF-only vs CUF+expanded comparison, reported as found.

**MVP Exclusions:** LLM Q&A assistant, trend/history view, ministry/sector filtering, benchmarking module, admin/RBAC system, any auto-escalation or workflow-execution behavior.

**MVP User Journey:**
```
Officer opens the risk view → sees ranked list of projects with scores + confidence
→ selects a flagged project → reads contributing factors → forms an escalation
decision based on evidence rather than a bare number → (separately) MoSPI/DIID
consumes the two comparison reports to judge whether the approach and current
data fields are adequate.
```

**MVP Success Condition:** A judge/reviewer can, within the demo, see a specific historical project that later actually overran, confirm the model would have flagged it earlier than standard reporting did, understand why via the explanation, and see the honest baseline/CUF comparison results.

---

## 16. Future-State User Journey

```text
USER GOAL: Identify which projects need attention before overrun grows
↓
ENTRY: Risk dashboard, monthly cycle
↓
SETUP: None required — data is pre-processed on ingestion
↓
CORE ACTION: Officer reviews ranked list
↓
PRODUCT RESPONSE: Score + confidence + top contributing factors per project
↓
USER DECISION: Which project(s) to escalate/prioritize for review
↓
OUTCOME: Attention directed earlier than descriptive reporting alone would allow
```

---

## 17. Functional Requirements

```text
REQ-P01
Name: Cost Overrun Risk Scoring
User/Actor: System, consumed by IPMD monitoring officer
User Goal: Know which projects are trending toward cost overrun
Trigger: New/updated CUF-derived project record available in the panel
Preconditions: Project has sufficient historical data points (threshold defined by AI/ML Engineer)
Expected Product Behavior: System computes a cost-overrun risk assessment using both baseline and ML methods
Expected User Outcome: Officer sees a score with an associated confidence level
Business Rules: BR-001, BR-002
Success Condition: Given a project with sufficient history, when a new cycle completes, then a score and confidence are produced
Failure Condition: Given insufficient history, when scoring is attempted, then the system returns "insufficient data" rather than a low-confidence number presented as reliable
Acceptance Criteria: On a held-out temporal test set, the ML approach's performance is measured against the baseline and reported (regardless of which wins)
Priority: P0

REQ-P02
Name: Time/Schedule Overrun Risk Scoring
(Mirrors REQ-P01 for schedule/milestone risk)
Priority: P0

REQ-P03
Name: Baseline vs ML Comparison Reporting
User/Actor: MoSPI/DIID (evaluator), system (produces the report)
User Goal: Judge whether prediction meaningfully outperforms a simple method
Trigger: Model training/evaluation run
Preconditions: Both baseline and ML models trained on identical temporal splits
Expected Product Behavior: Comparison computed on identical data splits and metrics
Expected User Outcome: A clear metrics-based verdict, in either direction
Business Rules: BR-003
Success Condition: A comparison report exists using a temporal (not random) split
Failure Condition: If ML does not outperform baseline, this is reported as-is, not omitted or reframed
Acceptance Criteria: Given a completed training run, when the comparison report is generated, then it states which approach performed better and by how much, using a temporal split
Priority: P0

REQ-P04
Name: CUF-only vs CUF+Expanded Feature Comparison
(Mirrors REQ-P03 for the feature-set dimension, per PS dimension c)
Priority: P0

REQ-P05
Name: Per-Project Explainability
User/Actor: IPMD monitoring officer
User Goal: Understand why a project was flagged
Trigger: Project scored above a defined risk threshold
Preconditions: Project has a valid score (not "insufficient data")
Expected Product Behavior: System surfaces top contributing factors in human-readable form
Expected User Outcome: A non-technical reviewer understands the basis for the flag
Business Rules: —
Success Condition: Given a flagged project, when its detail is viewed, then contributing factors are shown
Failure Condition: If the underlying model type cannot support factor-level explanation, this constrains model choice — a product constraint for the AI/ML Engineer, not an ML implementation detail
Acceptance Criteria: A non-technical reviewer can read the output and articulate why the project was flagged, in review/testing
Priority: P0

REQ-P06
Name: Risk Dashboard / Ranked View
User/Actor: IPMD monitoring officer
User Goal: See prioritized risk across the portfolio
Trigger: Officer opens the dashboard
Preconditions: Current cycle's scores are available
Expected Product Behavior: Sorted list by risk severity; clear distinction of insufficient-data projects
Expected User Outcome: Officer can identify top-N at-risk projects at a glance
Business Rules: BR-001
Success Condition: Given a scored portfolio, when the dashboard is opened, then projects are ranked and states are distinguishable
Failure Condition: —
Acceptance Criteria: A user/judge can identify the top-N at-risk projects and their reasons within the demo
Priority: P0
```

---

## 18. Business Rules

```text
BR-001: A project must have a minimum threshold of historical data points to receive a risk score; below threshold → "insufficient data" state, never a fabricated score.
BR-002: Risk scores must always be reported alongside a confidence indicator; a score without confidence is not permitted.
BR-003: The baseline-vs-ML and CUF-vs-expanded comparisons must be reported as found, even if the ML/expanded approach does not win — no result may be suppressed or reframed to appear favorable.
BR-004: Predictions must be traceable to a defined feature set and time window; no post-outcome information may be used to predict an outcome (data-leakage prevention).
```

---

## 19. Product States

**Project Risk State**
```text
Insufficient Data → Scored (Low/Medium/High Risk) → Flagged for Review
```
- **Insufficient Data:** Entry — project lacks minimum history (BR-001). User can see: "not yet scorable." User cannot: see a numeric score. Exit: sufficient history accumulates.
- **Scored:** Entry — a score + confidence has been produced. User can: view, rank, explain. User cannot: see a score without confidence (BR-002). Exit: new data cycle triggers re-scoring.
- **Flagged for Review:** Entry — score crosses a defined risk threshold. User can: see explanation, escalate outside the product. Exit: actual review/resolution happens in PMG/PRAGATI, outside this product's scope.

---

## 20. AI Product Requirements

**Why AI exists:** The overrun/delay outcome depends on many interacting, partially-observed factors that a fixed rule cannot reliably capture — this is a genuine predictive/classificatory task, not a deterministic one.

**What user problem AI addresses:** Job 1 (identify at-risk projects earlier than descriptive reporting).

**What capability AI provides:** Learning patterns in project trajectory (financial/progress history) associated with eventual overrun, beyond fixed thresholds — **conditional on outperforming the mandated baseline (REQ-P03); this is a hypothesis to test, not an assumed capability.**

**Conceptual input:** Project's CUF-derived feature history up to the scoring point (for CUF-only comparison) and, separately, an expanded feature set (for the CUF-sufficiency comparison).

**Conceptual output:** Risk score, confidence level, and human-readable contributing factors.

**How the user uses that output:** To prioritize review/escalation attention (Job 1) and to judge system credibility (Job 3).

**What happens if AI is uncertain or unavailable:** Project is marked "insufficient data" rather than given a low-confidence score presented as reliable (BR-001, BR-002).

**LLM component (P1):** Justified narrowly as a retrieval/explanation interface over the system's own predictions and data — not a general-purpose chatbot, and not a substitute for the core structured prediction task.

No model architecture, training methodology, or ML infrastructure is specified here — that belongs to the AI/ML Engineer.

---

## 21. User Controls

- **Filter/narrow the ranked view** (by ministry/sector) — P1, genuinely useful at portfolio scale.
- **No approve/reject/override control on scores** — the product is decision-support only; altering model output directly would undermine the "honest, evidence-based" positioning that is the product's core differentiator, and no evidence establishes this need.
- **No pause/resume/cancel controls** — there is no long-running user-initiated process requiring this.

---

## 22. Failure Experience

```text
Invalid/Missing Input: If a project's CUF data for the cycle is missing or malformed, it is excluded from that cycle's scoring rather than scored on incomplete data; prior valid score (if any) remains visible with its original timestamp.

Missing Data (insufficient history): Project shown as "insufficient data" — no score presented (BR-001).

External Failure: Not applicable at MVP — no external live dependency exists (no PAIMANA API/scraping dependency; product operates on the team's compiled panel).

AI Failure (model cannot produce a confident output): Project falls back to "insufficient data" / low-confidence state rather than a silently wrong score.

User Cancellation: Not applicable — no long-running user-initiated action exists in the MVP.

Retry: Scoring re-runs automatically on the next data cycle; no manual retry mechanism is required at MVP.
```

---

## 23. Data Requirements

```text
Data: Monthly CUF-derived project fields (cost, expenditure, physical progress %, milestones, schedule status)
Purpose: Core input for risk scoring
Source: Team-compiled historical panel (manual collection from Flash Reports)
Required: Yes
Sensitivity: Low — public infrastructure expenditure data, not personal data
Used By: Risk Prediction, Risk Explanation
Freshness Requirement: Monthly cycle, matching the CUF submission cadence

Data: Project identity (name/ID, ministry, sector, sanctioned cost) across years
Purpose: Enables per-project longitudinal tracking
Source: Team-compiled panel; requires fuzzy-matching validation (OQ-002)
Required: Yes, for time-series modeling; not required for cross-sectional fallback
Sensitivity: Low
Used By: All capabilities
Freshness Requirement: Static per project, updated as new cycles are added

Data: Expanded/additional variables beyond CUF (if identified)
Purpose: Enables the CUF-sufficiency comparison
Source: Not yet defined — depends on what supplementary data the team can source; UNKNOWN/OPEN
Required: Yes, for REQ-P04, but scope of "expanded" set is not yet defined
Sensitivity: Low (assumed, pending source identification)
Used By: Methodological Accountability
Freshness Requirement: Same cadence as CUF data, if available
```

---

## 24. External Dependencies

```text
Dependency: None required for MVP beyond the team's own manually-collected historical panel.
Purpose: —
Criticality: —
Product Impact if Unavailable: —
```

No live API or scraping dependency exists — already excluded per team decision (robots.txt-disallowed access to PAIMANA/OCMS confirmed directly).

---

## 25. Success Metrics

**Primary Outcome Metric**
```text
Metric: Early-warning lead time
Definition: Months between model flag date and the point at which the same risk becomes visible in standard descriptive reporting
Why It Matters: Directly measures the stated value mechanism (earlier visibility)
Measurement: Compare model flag date vs. first-materialized-variance date on held-out historical projects
Target: VALIDATION REQUIRED — no defensible number exists yet
```

**Product Metrics**
```text
Metric: Model performance vs. baseline
Definition: Chosen metric (e.g., precision/recall, AUC, or MAE — determined by AI/ML Engineer based on task framing)
Why It Matters: Directly answers PS dimension (b)
Measurement: Held-out temporal split
Target: VALIDATION REQUIRED

Metric: % of portfolio scorable (not "insufficient data")
Definition: Share of projects with enough history to receive a score
Why It Matters: Determines practical coverage of the product
Measurement: Count against final panel
Target: VALIDATION REQUIRED — depends on OQ-003

Metric: CUF-only vs CUF+expanded performance delta
Definition: Magnitude of predictive difference between feature sets
Why It Matters: Directly answers PS dimension (c)
Measurement: Same held-out split, two feature configurations
Target: VALIDATION REQUIRED
```

**Guardrail Metrics**
```text
Metric: False-positive rate
Definition: Share of flagged projects that are not actually high-risk
Why It Matters: High FP rate destroys reviewer trust and defeats the product's purpose
Measurement: Held-out evaluation
Target: VALIDATION REQUIRED

Metric: False-negative rate on known historical overrun projects
Definition: Share of well-documented past overruns the model fails to flag
Why It Matters: A high FN rate on known cases is a serious credibility risk
Measurement: Held-out evaluation against confirmed historical overruns
Target: VALIDATION REQUIRED
```

---

## 26. Product Assumptions

| ID | Assumption | Confidence | Impact if Wrong | Validation |
|---|---|---|---|---|
| A-001 | OCMS→PAIMANA schema maps cleanly enough for a consistent panel (OQ-001) | Medium | Critical — no time-series modeling possible | Side-by-side field comparison of one OCMS-era and one PAIMANA-era report |
| A-002 | Project identity is trackable across years (OQ-002) | Medium | Critical — same as above | Sample-based fuzzy matching (name + ministry + cost) |
| A-003 | The resulting panel is large enough for a genuine train/test split (OQ-003) | Low-Medium | High — constrains achievable modeling approach | Direct output of team's data-cleaning process |
| A-004 | Hackathon-scale limited timeframe applies | Medium | Medium — affects how much P0 scope is deliverable | Confirm actual SIH schedule |
| A-005 | No hidden bulk dataset is obtainable via a formal request channel (OQ-004) | Low | Medium — could reduce manual-collection burden if wrong | Check official SIH clarification/Q&A channel |
| A-006 | CUF fields carry at least some predictive signal | Medium | Medium — if false, product story shifts entirely to "CUF is insufficient" (still a valid finding) | Model training/evaluation itself |

---

## 27. Product Risks

```text
Risk: Data — historical panel too small/inconsistent (A-001/A-002/A-003)
Probability: Medium-High
Impact: Critical
Mitigation: Resolve OQ-001/OQ-002 immediately; design for graceful fallback to a smaller, consistent, cross-sectional panel

Risk: AI — ML fails to beat baseline
Probability: Medium
Impact: Medium
Mitigation: Report honestly; this is itself a valid, PS-required finding, not a failure

Risk: Technical — explainability method constrains viable model choice
Probability: Low-Medium
Impact: Medium
Mitigation: Favor inherently-explainable model families from the start (AI/ML Engineer decision)

Risk: Adoption — no evidence MoSPI would integrate this into real workflow
Probability: Medium
Impact: Low (outside hackathon scope)
Mitigation: Frame explicitly as a decision-support proof-of-concept

Risk: Dependency — reliance on manually-collected data quality
Probability: Medium
Impact: High
Mitigation: Document known missingness (already MoSPI-acknowledged) rather than presenting a falsely clean dataset

Risk: Competition — many teams likely attempt similar predictive dashboards
Probability: High
Impact: Medium
Mitigation: Differentiate via rigor of the two mandated comparisons, not model complexity or UI polish
```

---

## 28. Differentiation

```text
Existing Alternative: PAIMANA/OCMS dashboards
Limitation: Descriptive only, no forward signal
Our Product Capability: Per-project, explainable risk prediction
User Advantage: Earlier visibility into problems

Existing Alternative: Manual/heuristic review by officers
Limitation: Not systematic across ~1,981 projects, not reproducible, no lead time
Our Product Capability: Ranked, reproducible, explainable scoring
User Advantage: Scales review attention appropriately

Existing Alternative: Academic overrun-prediction models (non-Indian datasets)
Limitation: Small samples, different institutional context, not applied to MoSPI data; some report suspiciously high accuracy (~99.7%) plausibly from overfitting
Our Product Capability: Honest baseline-vs-ML and CUF-vs-expanded reporting, including unfavorable results
User Advantage: A defensible, credible finding rather than an inflated claim
```

The core differentiator is methodological honesty on the two mandated comparisons — not "we use AI," which is explicitly rejected as a standalone differentiator per Section 21 policy.

---

## 29. Out of Scope

- A general-purpose government data-entry/administration system (RBAC, approval workflows, audit logging) — already decided out of scope.
- Rebuilding PAIMANA's existing descriptive/reporting capability as a primary deliverable.
- Full 2006–present historical depth if the OCMS→PAIMANA schema transition cannot be reliably bridged — smaller, consistent panel preferred.
- Auto-escalation or automated notification to PIAs/ministries — this would shift the product into workflow-execution territory, unsupported by any established need or authority.
- A general-purpose chatbot over all PAIMANA data — the LLM component is scoped narrowly to explaining the system's own predictions (P1), not broader retrieval.
- Cross-project benchmarking/comparative analytics as a core (P0/P1) module — Future only.
- Approve/override controls letting users directly alter model output.
- Any live scraping/automated access to the PAIMANA/OCMS portal (robots.txt-disallowed, verified directly).

---

## 30. Open Questions

```text
Question: Do OCMS-era report fields map cleanly onto current PAIMANA/CUF fields? (OQ-001)
Why It Matters: Determines whether the multi-year panel is usable as one consistent series
Current Options: Bridge fully / bridge partially / restrict to PAIMANA-era only
Recommendation: Test on a sample immediately; default to the smaller consistent panel if unclear
Decision Owner: PM (with team-executed validation)

Question: Are project identifiers consistent across years, or is fuzzy-matching required? (OQ-002)
Why It Matters: Determines feasibility of true per-project time-series modeling
Current Options: Exact ID match / fuzzy match (name+ministry+cost) / fallback to cross-sectional only
Recommendation: Test fuzzy-matching on a sample now
Decision Owner: PM (with team-executed validation)

Question: What is the final usable panel size? (OQ-003)
Why It Matters: Determines which validation strategy (true temporal split vs. cross-sectional) is honestly achievable
Current Options: Depends entirely on OQ-001/OQ-002 resolution
Recommendation: Resolve dependencies first
Decision Owner: PM

Question: Is there a formal channel to request a bulk dataset from MoSPI? (OQ-004)
Why It Matters: Could materially reduce manual-collection burden
Current Options: Check official SIH Q&A channel
Recommendation: Check in parallel; does not block current work
Decision Owner: PM / Team

Question: What evaluation threshold will judges apply to dimensions (b) and (c)? (OQ-005)
Why It Matters: PS requires the comparisons but states no defined "significant gains" threshold
Current Options: Report actual numbers transparently regardless of a threshold
Recommendation: Do not invent a target; report findings as measured
Decision Owner: PM
```

---

## 31. Product Decision Log

```text
DEC-001
Decision: Core deliverable is a predictive/prescriptive layer, not a re-descriptive dashboard
Reason: PS's own explicit "descriptive → predictive/prescriptive" framing
Alternatives Considered: Rebuilding/extending PAIMANA's descriptive capability
Impact: Defines entire product direction
Status: Approved

DEC-002
Decision: Both PS comparisons (baseline-vs-ML, CUF-vs-expanded) are mandatory P0 deliverables, reported honestly regardless of outcome
Reason: PS dimensions (b) and (c) are explicit
Alternatives Considered: Treating them as optional/secondary
Impact: Establishes the product's core differentiation strategy
Status: Approved

DEC-003
Decision: Historical data manually collected (5+ years, OCMS + PAIMANA era) rather than relying on a provided bulk dataset
Reason: No bulk dataset/API provided; live-site scraping disallowed (verified)
Alternatives Considered: Automated scraping (rejected — robots.txt)
Impact: Defines data-acquisition approach and current highest project risk
Status: Approved

DEC-004
Decision: Full admin/RBAC/data-entry system is out of scope
Reason: Does not address the PS's predictive/prescriptive mandate; scope-creep risk
Alternatives Considered: Building a lightweight admin layer "for completeness"
Impact: Keeps MVP focused
Status: Approved

DEC-005
Decision: Full 2006–present depth is not required if OCMS→PAIMANA schema cannot be reliably bridged; smaller consistent panel is acceptable
Reason: Defensibility over raw depth
Alternatives Considered: Forcing full historical depth regardless of consistency
Impact: Sets the fallback strategy for OQ-001
Status: Approved
```

---

## 32. Problem → Feature Traceability

| Problem | User Need | Capability | Feature | Outcome |
|---|---|---|---|---|
| No forward risk signal | Job 1 | Risk Prediction | Assess cost/schedule risk | Earlier visibility |
| Black-box scores aren't actionable | Job 2 | Risk Explanation | Show contributing factors | Defensible, explainable flags |
| No prioritization across 1,981 projects | Job 1 | Risk Prioritization | Rank by risk / status states | Scaled review attention |
| Unproven whether AI helps | Job 3 | Methodological Accountability | Baseline-vs-prediction comparison | Defensible evidence for/against AI |
| Unknown if CUF fields suffice | Job 4 | Methodological Accountability | CUF-vs-expanded comparison | Honest finding, either direction |
| Static output hard to interrogate | Job 2 (extended) | Project Intelligence Retrieval | Plain-language Q&A (P1) | Conversational access to reasoning |
| No sense of trajectory | Job 1 (extended) | Risk History | Trend view (P1) | Awareness of worsening/improving risk |

Every P0 feature traces to either explicit PS text or the PS's own stated descriptive-to-predictive gap. None trace only to "technically impressive."

---

## 33. Downstream Handoff Notes

**For Product + Solutions Architect:** The system must support: ingesting a periodically-refreshed, project-level historical panel; producing per-project risk scores with confidence indicators (REQ-P01/P02); generating and storing two comparison reports (REQ-P03/P04); serving explainable per-project output (REQ-P05); and a ranked view (REQ-P06). No live external API dependency exists at MVP. Data volume is bounded (~1,981 projects, monthly cadence) — this is not a high-throughput system.

**For AI/ML Engineer:** Two prediction tasks (cost-overrun risk, schedule-overrun risk), each requiring a baseline method and an ML method, evaluated on a temporal (not random) split, with a second axis of comparison (CUF-only vs. expanded features). Explainability is a **product requirement** (REQ-P05) — factor model choice accordingly. Confidence/data-sufficiency thresholding is required (BR-001/BR-002). Panel size, schema continuity, and project-ID continuity (OQ-001/002/003) are upstream blockers you should flag immediately if they constrain feasible modeling approach.

**For UX Architect:** Primary user is the IPMD monitoring officer. Core journey: open ranked view → select a flagged project → read explanation → decide. States to support: insufficient-data, scored (with confidence), flagged. Failure state (insufficient data) must be visually distinct, not hidden. No approve/override controls needed. P1: filtering, trend view, Q&A interface.

**For Software Engineer:** Approved P0 requirements are REQ-P01 through REQ-P06 (Section 17), with business rules BR-001–BR-004 (Section 18) as non-negotiable constraints (especially: never present a score without confidence; never suppress an unfavorable comparison result). Failure behavior defined in Section 22.

**For Security Engineer:** Data sensitivity is low (public infrastructure expenditure data, not personal data) — no PII protection is required for MVP. The main integrity concern is not confidentiality but **output honesty**: BR-003 (comparisons must not be suppressed/reframed) is a product-integrity rule you should treat as security-adjacent — flag any technical shortcut that would make it easy to silently drop an unfavorable finding.

**For Competition Strategist:** Core differentiator is methodological rigor on the two mandated comparisons (Section 28), not AI sophistication. Magic-moment framing: a real historical project, later confirmed to have overrun, flagged by the model using only pre-overrun data, with stated lead time and plain-language reasoning. Known limitation to state proactively: panel size/feasibility is conditional on OQ-001/002/003, which should be resolved and disclosed honestly, not glossed over.