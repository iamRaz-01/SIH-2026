# FEATURE REQUIREMENTS DOCUMENT (FRD) — MASTER
## SIH26103 — Predictive/Prescriptive Infrastructure Monitoring Layer

```text
Document Status: Draft — authoritative functional/behavioral requirements, pending team-lead approval
Version: v1.0
Date: 2026-08-30
Source Priority Applied: Approved product decisions > Approved PRD > Approved MVP scope
                          > Product vision > Existing feature architecture
                          > Original problem statement > Proposed features > Inference
Parent Documents: official-Problem-Statement.txt · SIH26103_Project_Context.md · Product_Requirement.md v1.0
```

This document is the single authoritative source of functional requirements for **all eight** features currently identified for the product: the six PRD-approved capabilities (P0/P1) and the two proposed USP features (Intelligent Anomaly Detection, Project Network Intelligence). All downstream teams (Architecture, AI/ML, Engineering, UX, Security, Data, QA) should treat this document, not the PRD narrative, as the source of *what each feature must do*.

---

## FEATURE MATRIX

| ID | Feature | Capability | Priority | Source | Confidence |
|---|---|---|---|---|---|
| F-01 | Risk Prediction (Cost & Schedule) | Risk Prediction | **P0** | PRD REQ-P01/P02 | High |
| F-02 | Methodological Accountability | Methodological Accountability | **P0** | PRD REQ-P03/P04 | High |
| F-03 | Risk Explanation | Risk Explanation | **P0** | PRD REQ-P05 | High |
| F-04 | Risk Prioritization (Dashboard) | Risk Prioritization | **P0** | PRD REQ-P06 | High |
| F-05 | Project Intelligence Retrieval (Q&A) | Project Intelligence Retrieval | P1 | PRD §12/§14 | Medium |
| F-06 | Risk History / Trend Awareness | Risk History / Trend Awareness | P1 | PRD §12/§14 | Medium |
| F-07 | Intelligent Anomaly Detection | Behavioral Anomaly Detection | **P1 (proposed)** | Proposed/USP | Medium — pending approval |
| F-08 | Project Network Intelligence | Cross-Project Relationship Intelligence | **P2 / partly Future (proposed)** | Proposed/USP | Medium — pending approval, overlaps a PRD Future item |

F-01–F-04 are non-negotiable P0 (directly answer PS dimensions a, b, c). F-05/F-06 are approved-but-deferrable P1. F-07/F-08 are **not yet formally approved** — see OPEN DECISIONS and CONFLICTS at the end of this document before treating them as committed scope.

---

# F-01: Risk Prediction (Cost & Schedule Overrun Scoring)

### Purpose
Score each project's likelihood of cost overrun and, separately, schedule/time overrun, so reviewers have a forward-looking signal instead of only after-the-fact variance (Job 1).

### Scope
**In:** cost-overrun scoring; schedule/time-overrun scoring; confidence/data-sufficiency indication; computation via both a baseline method and an ML method each cycle.
**Out:** root-cause diagnosis (see F-03); auto-escalation/notification; any live external data source (no PAIMANA API/scraping dependency — DEC-003).

### Actors
System (computes); IPMD monitoring officer (consumes).

### Preconditions
Project has a minimum threshold of historical data points (BR-001; exact threshold owned by AI/ML Engineer).

### Functional Requirements
- **FR-01-01:** The system must compute a cost-overrun risk assessment for each project with sufficient history, each cycle, using both a baseline method and an ML method.
- **FR-01-02:** The system must compute a schedule/time-overrun risk assessment, mirroring FR-01-01.
- **FR-01-03:** Every score must be accompanied by a confidence/data-sufficiency indicator (BR-002) — a score without confidence must never be presented.
- **FR-01-04:** Below the minimum-history threshold, the system must return an "insufficient data" state rather than a fabricated or low-confidence score presented as reliable (BR-001).
- **FR-01-05:** Predictions must be traceable to a defined feature set and time window; no post-outcome information may be used to predict an outcome (BR-004, data-leakage prevention).
- **FR-01-06:** Scoring must re-run automatically on each new data cycle; no manual retry mechanism is required at MVP.

### Inputs
CUF-derived project fields (cost, expenditure, physical progress %, milestones, schedule status) up to the scoring point; for the CUF-vs-expanded comparison (F-02), an additional expanded-feature-set variant.

### Outputs
Cost risk score + confidence; schedule risk score + confidence; "insufficient data" flag where applicable.

### Business Rules
BR-001 (minimum-history gate), BR-002 (confidence mandatory), BR-004 (no post-outcome leakage).

### State & Behavior
`Insufficient Data → Scored (Low/Medium/High Risk) → Flagged for Review` (exit from Flagged is resolution in PMG/PRAGATI, outside product scope).

### Error & Failure Handling
- Missing/malformed CUF data for a cycle → exclude project from that cycle's scoring; retain the prior valid score with its original timestamp.
- AI failure or an uncertain model output → fall back to insufficient-data/low-confidence state, never a silently wrong score.

### Edge Cases
- Project exactly at the minimum-history threshold.
- Project whose history spans the OCMS→PAIMANA schema boundary (OQ-001).
- A single extreme-outlier cycle skewing the score.

### Permissions & Security Requirements
Read-only; no override control. Data sensitivity low (public expenditure data, not PII).

### Dependencies
Team-compiled historical panel; OQ-001 (schema continuity), OQ-002 (project-ID continuity), OQ-003 (panel size).

### Acceptance Criteria
```
Given a project with sufficient history,
When a new cycle completes,
Then a cost score, a schedule score, and their confidence levels are produced.

Given a project with insufficient history,
When scoring is attempted,
Then the system returns "insufficient data" rather than a score.
```

---

# F-02: Methodological Accountability (Baseline-vs-ML & CUF-vs-Expanded)

### Purpose
Prove, honestly and on identical splits, whether ML meaningfully outperforms a simple baseline (PS dimension b) and whether CUF fields alone are sufficient for prediction (PS dimension c) — Jobs 3 and 4.

### Scope
**In:** comparison report generation on identical temporal splits for both required dimensions; honest reporting regardless of outcome.
**Out:** defining a numeric "significant gains" threshold (OQ-005, unresolved by the PS itself); model architecture selection (AI/ML owned).

### Actors
System (generates reports); MoSPI/DIID (evaluator/consumer).

### Preconditions
Baseline and ML models trained on identical temporal (not random) splits; CUF-only and CUF+expanded feature variants trained under otherwise-identical conditions.

### Functional Requirements
- **FR-02-01:** The system must generate a baseline-vs-ML comparison computed on identical data splits and metrics.
- **FR-02-02:** The comparison must use a temporal, not random, split.
- **FR-02-03:** The report must state which approach performed better and by how much.
- **FR-02-04:** Unfavorable results (ML underperforming baseline) must be reported as found — never omitted or reframed (BR-003).
- **FR-02-05:** The system must generate a CUF-only vs. CUF+expanded feature comparison, mirroring FR-02-01–04, per PS dimension (c).
- **FR-02-06:** The scope of the "expanded" feature set used must be explicitly documented alongside the report.

### Inputs
Trained baseline and ML model outputs; both feature-set variants; held-out temporal test set.

### Outputs
Two stored, retrievable comparison reports (metrics, verdict, magnitude of difference) — not transient-only display.

### Business Rules
BR-003 (no suppression/reframing of an unfavorable finding), BR-004 (leakage prevention applies to comparison-set construction as well as scoring).

### State & Behavior
Generated per training/evaluation run, not per live data cycle like F-01's scoring.

### Error & Failure Handling
If the expanded-feature data source is undefined or unavailable, the FR-02-05 comparison must be marked "not yet available" rather than computed against placeholder/incomplete data.

### Edge Cases
- Baseline and ML performance tie within noise.
- Expanded features available for only a subset of the panel — comparison must be explicitly labeled as partial-coverage.

### Permissions & Security Requirements
Read-only. BR-003 is treated as security-adjacent (PRD §33): any technical shortcut that could silently drop an unfavorable finding must be flagged, not implemented.

### Dependencies
F-01's trained models; OQ-003 (panel size affects split validity); expanded-variable data source (PRD §23 — currently undefined, **[OPEN DECISION]** carried from PRD).

### Acceptance Criteria
```
Given a completed training run,
When the comparison report is generated,
Then it states which approach performed better, by how much, on a temporal
split — including when the result is unfavorable to ML or to expanded features.
```

---

# F-03: Risk Explanation (Per-Project Explainability)

### Purpose
Make a flagged score defensible and actionable to a non-technical reviewer (Job 2). A score without a reason is, per Product Principles, worse than no score.

### Scope
**In:** top contributing factors in plain language per flagged project; which data fields drove the assessment.
**Out:** raw technical explanation artifacts (e.g., unprocessed model internals) — output must be human-readable, not a technical dump.

### Actors
System; IPMD monitoring officer.

### Preconditions
Project has a valid score (not "insufficient data").

### Functional Requirements
- **FR-03-01:** For every project scored above the defined risk threshold, the system must surface top contributing factors in human-readable form.
- **FR-03-02:** The explanation must name which underlying data field(s) drove the assessment.
- **FR-03-03:** If the underlying model type cannot support factor-level explanation, this constrains model choice upstream — a product constraint communicated to AI/ML, not resolved here.
- **FR-03-04 [INFERRED]:** Explanation output must not assert a cause beyond what the model's contributing factors directly support (consistency with the non-causal-claim principle applied elsewhere in this document — see F-07 BR-ANOM-001).

### Inputs
The trained model's flagged output for a given project/cycle.

### Outputs
Plain-language list of contributing factors, linked to specific data fields.

### Business Rules
None beyond REQ-P05 sourcing; FR-03-04 above.

### State & Behavior
Generated whenever a project transitions into the "Flagged for Review" state (F-01).

### Error & Failure Handling
**[INFERRED, extension of BR-002's spirit]** If an explanation cannot be generated for a flagged project (e.g., model-type limitation), the system must not display the flag without an explanation — it must show "explanation unavailable" rather than a bare score.

### Edge Cases
- Multiple contributing factors of near-equal weight.
- A contributing factor is itself a missing/imputed field — this must be disclosed, not hidden.

### Permissions & Security Requirements
Read-only, no override.

### Dependencies
F-01 (source of the flagged score).

### Acceptance Criteria
```
Given a flagged project,
When its detail is viewed,
Then contributing factors are shown in plain language, and a non-technical
reviewer can articulate why the project was flagged.
```

---

# F-04: Risk Prioritization (Dashboard / Ranked View)

### Purpose
Let an officer identify top-N at-risk projects across ~1,981 projects without manually scanning tables (Job 1).

### Scope
**In:** sorted list by risk severity; clear distinction of insufficient-data / low-risk / flagged states.
**Out:** filtering by ministry/sector is a separate P1 sub-feature (FR-04-03); auto-escalation is out of scope entirely.

### Actors
System; IPMD monitoring officer.

### Preconditions
Current cycle's scores are available.

### Functional Requirements
- **FR-04-01:** The system must present projects sorted by risk severity.
- **FR-04-02:** The system must visually/functionally distinguish insufficient-data, scored (low/medium/high), and flagged-for-review states — the failure state must not be hidden.
- **FR-04-03 (P1):** The system should support filtering/narrowing the ranked view by ministry or sector.
- **FR-04-04:** The dashboard must reflect the current cycle's scores with no manual setup/trigger required from the user.

### Inputs
Current-cycle scores, confidence values, and states for all projects.

### Outputs
Ranked, (P1) filterable list view.

### Business Rules
BR-001 (insufficient-data state must remain visible, not suppressed).

### State & Behavior
Refreshes on each new data cycle.

### Error & Failure Handling
**[INFERRED]** If the current cycle's scoring run is incomplete or failed, the dashboard must show the prior cycle's scores with a visible "not yet updated" indicator, rather than a blank or silently stale view.

### Edge Cases
- Ties in risk ranking.
- A portfolio cycle with an unusually large share of "insufficient data" projects — coverage must not be misrepresented.

### Permissions & Security Requirements
Read-only, no override.

### Dependencies
F-01 (scores), F-03 (drill-down explanation).

### Acceptance Criteria
```
Given a scored portfolio,
When the dashboard is opened,
Then projects are ranked, states are distinguishable, and a user can identify
the top-N at-risk projects and their reasons within the demo/view.
```

---

# F-05: Project Intelligence Retrieval (LLM Q&A) — P1

### Purpose
Let a user interrogate the system's own predictions/data conversationally rather than only through static views (Job 2, extended). This is the PS's own named outcome (h) — a required deliverable category, though the PRD sets it at P1, not P0.

### Scope
**In:** plain-language Q&A over the system's own predictions and underlying project data; summarizing why a set of flagged projects were grouped together.
**Out:** a general-purpose chatbot over all PAIMANA data (explicitly excluded, PRD §29); not a substitute for the core structured prediction task (F-01–F-04).

### Actors
IPMD monitoring officer and other authorized viewers.

### Preconditions
Underlying risk/explanation data exists for the queried project(s).

### Functional Requirements
- **FR-05-01:** The system must answer plain-language questions about a specific project's data and prediction.
- **FR-05-02:** The system must be able to summarize why a set of projects were flagged together.
- **FR-05-03:** Responses must be grounded only in the system's own computed predictions/data — never introduce external or fabricated information.
- **FR-05-04:** If a question cannot be answered from available data, the system must state this rather than fabricate an answer.

### Inputs
User's natural-language query; underlying risk/explanation data (and, where present, F-07/F-08 data) for the referenced project(s).

### Outputs
Natural-language answer grounded in system data.

### Business Rules
Must not override BR-003 — if asked about a comparison result, the answer must not reframe an unfavorable finding.

### State & Behavior
Stateless per-query; no persistent conversation memory required at MVP.

### Error & Failure Handling
- Ungrounded/out-of-scope question → decline or ask for clarification rather than hallucinate.
- Underlying data temporarily unavailable → state this plainly.

### Edge Cases
- A question spanning multiple unrelated projects.
- A question about a project currently in "insufficient data" state.
- Ambiguous project-name references, given OQ-002's project-identity-continuity risk.

### Permissions & Security Requirements
Read-only. **[INFERRED — no RBAC model is defined at MVP per DEC-004]**: must not expose data beyond what an officer's role already permits, once such a role model exists.

### Dependencies
F-01, F-03, and (if approved/built) F-07/F-08 as retrievable context.

### Acceptance Criteria
```
Given a project with an existing score and explanation,
When a user asks a plain-language question about it,
Then the system answers using only that project's own data, or states that
it cannot answer.
```

---

# F-06: Risk History / Trend Awareness — P1

### Purpose
Convey trajectory (worsening / stable / improving), not just a point-in-time score (Job 1, extended).

### Scope
**In:** trend view across a project's recent scored cycles; indication of whether a previously-flagged project's status has changed.
**Out:** full historical multi-decade exploration beyond the validated panel (PRD §14, Future).

### Actors
System; IPMD monitoring officer.

### Preconditions
Project has at least two scored cycles.

### Functional Requirements
- **FR-06-01:** The system must display how a project's risk assessment (score/state) has changed across its recent scored cycles.
- **FR-06-02:** The system must indicate whether a previously-flagged project's status has changed (improved / worsened / unchanged) since its last flag.
- **FR-06-03:** The trend view must respect the same insufficient-data state rules as current scoring — a cycle with insufficient data must be shown as a gap, never interpolated.

### Inputs
A project's sequence of historical scores/states across cycles.

### Outputs
Trend indicator/view per project.

### Business Rules
Consistency with BR-001/BR-002 across all displayed cycles.

### State & Behavior
Updates each cycle alongside F-01's current scoring.

### Error & Failure Handling
Gap cycles (insufficient data) are shown as gaps, never smoothed or interpolated.

### Edge Cases
- Project with only one scored cycle — no trend is computable; the system must state this rather than show a flat or misleading trend.
- Schema-boundary discontinuity (OQ-001) affecting historical comparability.

### Permissions & Security Requirements
Read-only.

### Dependencies
F-01 (historical scores).

### Acceptance Criteria
```
Given a project with two or more scored cycles,
When its trend view is opened,
Then the change in risk status across cycles is shown, with any
insufficient-data cycles shown as gaps.
```

---

# F-07: Intelligent Anomaly Detection — P1 (proposed, pending approval)

### Purpose
F-01 answers *"will this project likely overrun?"* — a forward-looking, trend-based judgment requiring accumulated history. Anomaly Detection answers a different question: *"is something behaviorally unusual happening in this project right now?"* — catching sudden divergence (e.g., expenditure accelerating while physical progress stalls) that may not yet be large or sustained enough to move a risk score, giving reviewers an earlier, independent investigative trigger.

### Scope
**In:** per-project, per-cycle computation of behavioral divergence between financial and physical-progress indicators (and other available CUF-derived fields), relative to that project's own historical pattern; a plain-language description of what triggered the flag; display of the flag alongside — not merged into — the risk score.
**Out:** asserting a cause (fraud, misuse, mismanagement); automated escalation/notification to any external party; use of any field not present in the compiled panel; using anomaly output as a substitute for, or contaminant of, F-02's mandated comparisons.

### Actors
System (computes/displays each cycle); IPMD monitoring officer (investigative trigger); MoSPI/DIID (evidence of monitoring rigor, not a compliance verdict).

### Preconditions
Project has a minimum number of consecutive historical cycles sufficient to establish a baseline behavioral pattern. **[OPEN DECISION: exact minimum — AI/ML Engineer; may differ from F-01's BR-001 threshold.]**

### Functional Requirements
- **FR-07-01:** The system must compute, each cycle, the change in a project's financial indicators (e.g., expenditure) against the change in its physical-progress indicators, relative to that project's own historical pattern.
- **FR-07-02:** The system must flag a cycle as anomalous when this divergence exceeds a defined threshold. **[OPEN DECISION: threshold value/method — AI/ML Engineer.]**
- **FR-07-03:** The anomaly flag must be computed, stored, and displayed independently of the F-01 risk score; anomaly status must never alter the value used in F-02's comparison reports.
- **FR-07-04:** Every anomaly flag must be accompanied by a plain-language description naming the specific field(s)/behavior that triggered it.
- **FR-07-05:** Anomaly output must state only that a pattern is unusual and warrants review — it must never state or imply a specific cause.
- **FR-07-06:** If a project lacks the minimum baseline history, the system must display "insufficient history for anomaly baseline" — never a false "no anomaly detected."
- **FR-07-07:** F-04's ranked view must be able to indicate active anomaly flags as a state distinguishable from risk-flag state.
- **FR-07-08 (P2 candidate):** The ranked view should support filtering/sorting by anomaly presence.

### Inputs
CUF-derived financial and physical-progress fields already used by F-01, at project × cycle granularity. No additional data source required.

### Outputs
Per project, per cycle: anomaly boolean/severity state; triggering field(s); plain-language description; baseline-sufficiency indicator.

### Business Rules
- **BR-ANOM-001:** Anomaly output must never assert or imply a cause (fraud, corruption, misuse).
- **BR-ANOM-002:** Anomaly flags are supplementary; they must not be substituted for, or silently merged into, F-02's mandated comparisons.
- **BR-ANOM-003:** Anomaly-baseline sufficiency and F-01's risk-scoring sufficiency (BR-001) are evaluated independently. **[OPEN DECISION: confirm this independence is intended.]**

### State & Behavior
`No Anomaly → Anomaly Flagged → (Reviewed/Cleared?)`
**[OPEN DECISION / possible CONFLICT: PRD §21 excludes approve/reject/override controls on model output. Does a "clear/dismiss" action on an anomaly flag count as such a control?]**

### Error & Failure Handling
- Missing cycle data for a field → exclude that cycle from anomaly computation; never fabricate a value.
- Anomaly computation failure → display "anomaly status unavailable," never a silent omission.
- Known MoSPI-acknowledged missingness (commissioning year, gestation period, revised estimates) must not itself be treated as an anomaly.

### Edge Cases
- Newly commissioned project with no baseline history.
- Project with skipped/irregular reporting cycles.
- Legitimate large but non-risky expenditure spikes (e.g., an approved lump-sum milestone payment) — false-positive risk requires threshold design to account for known legitimate patterns where feasible.
- Cycle where physical progress is unreported but expenditure is reported (partial data).

### Permissions & Security Requirements
Read-only at MVP; no override/approve control (pending resolution of the state-behavior open decision above). Data sensitivity low.

### Dependencies
Same historical panel and OQ-001/OQ-002/OQ-003 risk as F-01; shares F-01's input pipeline but is computationally and presentationally independent (BR-ANOM-002).

### Acceptance Criteria
```
Given a project with sufficient baseline history,
When a cycle's financial-vs-progress divergence exceeds the defined threshold,
Then the system flags the project as anomalous, displays the triggering
field(s) and a plain-language description, and the flag does not alter the
project's risk score.

Given a project without sufficient baseline history,
When anomaly evaluation runs for that cycle,
Then the system displays "insufficient history for anomaly baseline" rather
than a "no anomaly" result.
```

---

# F-08: Project Network Intelligence — P2 / partly Future (proposed, pending approval)

### Purpose
F-01 treats each project independently. In reality, projects sharing geography, sector, implementing agency, timeline, or project type can share exposure to the same upstream risk drivers (e.g., a regional land-acquisition delay, or an agency-wide execution issue). Network Intelligence surfaces these relationships so a reviewer can interpret an individual project's risk in context, potentially revealing clustered/systemic risk that single-project analysis cannot.

### Scope
**In:** computing relationship/similarity signals between projects from fields already in the compiled panel (location, sector, agency, project type, timeline overlap, description-text similarity); presenting groupings with the basis for each relationship; showing a project's related-project set alongside its own risk/anomaly status.
**Out:** asserting a causal relationship between projects; a standalone cross-project benchmarking/comparative-analytics module (already Future-scoped — see CONFLICTS); automated action based on cluster membership; any data outside the compiled panel.

### Actors
System (computes each cycle); IPMD monitoring officer (investigative context); MoSPI/DIID (systemic/agency/regional-pattern signal, distinct from individual accountability).

### Preconditions
At least a minimum number of projects share at least one relationship-signal category in the compiled panel. **[OPEN DECISION: minimum count/threshold.]**

### Functional Requirements
- **FR-08-01:** The system must compute similarity/relationship signals between projects using available fields: same/nearby location, same sector, same implementing agency, timeline overlap, and project-type/description similarity.
- **FR-08-02:** The system must present related-project groupings to the user as a navigable structure (visual form is a UX decision, not defined here).
- **FR-08-03:** Each grouping must display which specific signal(s) produced the relationship (explainability, mirroring F-03's principle).
- **FR-08-04:** The system must let a user view a given project's related-project set together with that project's own F-01 risk score and F-07 anomaly status (if built).
- **FR-08-05 (Future — see CONFLICTS):** Any cluster-level risk rollup (e.g., "N of M related projects flagged") must be visually and functionally distinguished from the individually mandated per-project risk score, and must not be presented as a validated new score without separate methodology and reporting.
- **FR-08-06:** Relationship computation must not use any post-outcome information for either project in a pair (mirrors BR-004).

### Inputs
Project metadata fields already in the compiled panel (location, sector, agency, project type, timeline, free-text description). No external data source.

### Outputs
Per project: list of related projects; specific shared signal(s) per relationship; (Future) optional cluster-level risk summary, clearly labeled as distinct from individual scores.

### Business Rules
- **BR-NET-001:** Relationships are correlational only — output must never state or imply that one project's status caused or explains another's.
- **BR-NET-002:** Any cluster-level rollup must be clearly, visibly distinguished from the individually mandated risk score and must never substitute for it.

### State & Behavior
Relationships recomputed each cycle as the panel updates. No persistent "confirmed relationship" or user-editable state currently defined. **[OPEN DECISION: is human-in-the-loop confirmation/dismissal of a relationship required?]**

### Error & Failure Handling
- Insufficient shared-signal overlap → display "no identified relationships," not a forced/weak grouping.
- Missing description-similarity text for a project → exclude that one signal for that project; continue with other available signals.
- Relationship computation failure → display "relationships unavailable" rather than an empty/misleading result.

### Edge Cases
- Two projects sharing only coincidental agency+sector overlap risking a meaningless grouping (over-clustering) — requires a minimum signal-overlap threshold. **[OPEN DECISION.]**
- A project with an unusually large number of relationships ("hub" project) — display/scaling is a UX concern, not addressed here.
- Duplicate/renamed project records across the OCMS→PAIMANA schema boundary (OQ-002) being misidentified as two "related" projects when they are actually the same project — a data-integrity dependency, not a relationship-modeling error, and must be resolved upstream before this feature can be trusted.

### Permissions & Security Requirements
Read-only; no user-editable relationship overrides currently defined. Data sensitivity low.

### Dependencies
**Critical:** OQ-001 and OQ-002 — false project-identity duplication directly risks producing false "relationships"; this dependency is stronger here than for F-01. Also depends on F-01/F-07 outputs for combined per-project display (FR-08-04).

### Acceptance Criteria
```
Given two or more projects that share at least the defined minimum
relationship-signal overlap,
When the network view is generated for the current cycle,
Then the projects are grouped together and the specific shared signal(s)
are shown as the basis for the grouping.

Given a project with no relationship-signal overlap above threshold with any
other project,
When the network view is generated,
Then the system displays "no identified relationships" for that project.
```

---

## CROSS-FEATURE DEPENDENCY MAP

```text
F-01 (Risk Prediction) ──┬─→ F-02 (Methodological Accountability)
                          ├─→ F-03 (Risk Explanation) ──→ F-04 (Dashboard)
                          ├─→ F-06 (Trend Awareness)
                          ├─→ F-05 (Q&A) [reads F-01, F-03, and F-07/F-08 if present]
                          └─→ F-07 (Anomaly Detection) [shares input panel, independent output]

F-04 (Dashboard) ──displays states from──> F-01, F-03, F-07 (if built), F-08 (if built)

F-08 (Network Intelligence) ──reads──> F-01, F-07 (if built); depends most heavily on
                                        OQ-001/OQ-002 of all eight features.
```

---

## OPEN DECISIONS

1. Whether F-07 and F-08 are formally approved for build, and at what priority — the approved PRD is silent on both; the priority shown in the Feature Matrix is a recommendation only.
2. F-07 anomaly-baseline minimum-history threshold and divergence threshold (AI/ML Engineer-owned).
3. Whether an anomaly flag (F-07) needs a "reviewed/cleared" state, and whether that constitutes an override control excluded by PRD §21.
4. Whether anomaly-baseline sufficiency is independent of F-01's risk-scoring sufficiency (BR-ANOM-003).
5. F-08 minimum project count and minimum signal-overlap threshold (over-clustering guardrail).
6. Whether any human-in-the-loop confirmation/dismissal of a computed relationship (F-08) is required.
7. Whether FR-08-05 (cluster-level rollup) is approved at all, or remains permanently Future per the existing PRD Out-of-Scope entry.
8. Data source and scope of the "expanded" feature set for F-02's CUF-vs-expanded comparison (carried forward from PRD §23 — unresolved).
9. Evaluation threshold ("significant gains") judges will apply to F-02's two comparisons (OQ-005, carried forward from PRD — no defensible number exists yet).
10. Final usable panel size, and therefore which validation strategy is honestly achievable (OQ-003, carried forward — blocks precise thresholds across F-01, F-02, F-07, F-08).

## CONFLICTS

- **[CONFLICT]** The approved PRD (§9, §14, §29) explicitly defers "cross-project benchmarking/comparative analytics as a standalone module" and "portfolio-level driver aggregation distinct from per-project explanation" to **Future**, not P0/P1. F-08 — specifically FR-08-05's cluster-level risk rollup — overlaps conceptually with these already-deferred capabilities. Resolved in this document by keeping F-08's relationship-display core (FR-08-01–04, FR-08-06) as buildable P2, and isolating FR-08-05 as Future, consistent with the existing PRD. Requires explicit stakeholder confirmation.
- **[CONFLICT]** SIH26103_Project_Context.md's Decision Log states USP/innovation-layer features were "explicitly excluded from this Project Context document" per direct team instruction — an exclusion scoped to that document, not a rejection of the features themselves. No existing approved artifact affirmatively endorses building F-07 or F-08. Both are treated here as **proposed, not approved**.
- **[CONFLICT]** PRD §21 states no approve/reject/override control exists on scores, framed as core to the product's "decision-support only" positioning. F-07 (anomaly "cleared" state) and F-08 (relationship confirmation) both introduce natural candidates for such a control. Must be resolved explicitly, not assumed either way.

## REQUIREMENT TRACEABILITY

| Feature | Primary Source |
|---|---|
| F-01 Risk Prediction | PRD REQ-P01/P02 |
| F-02 Methodological Accountability | PRD REQ-P03/P04 |
| F-03 Risk Explanation | PRD REQ-P05 |
| F-04 Risk Prioritization | PRD REQ-P06 |
| F-05 Project Intelligence Retrieval | PRD §12/§14 (P1, PS-named outcome h) |
| F-06 Risk History / Trend Awareness | PRD §12/§14 (P1) |
| F-07 Intelligent Anomaly Detection | Proposed/USP — not present in approved PRD |
| F-08 Project Network Intelligence | Proposed/USP — conceptually adjacent to PRD §9/§14 Future items |
| Explainability extensions in F-05/F-07/F-08 | [INFERRED] by extension from approved REQ-P05 |
| Non-causal-claim rules (BR-ANOM-001, BR-NET-001) | [INFERRED] — no direct PRD precedent; added given the data's public/institutional sensitivity |

## FINAL COMPLETENESS CHECK

F-01–F-04 (P0) are complete and directly traceable to explicit, approved PRD requirements — ready for Architecture/AI-ML/Engineering handoff, conditional only on the pre-existing OQ-001/002/003 data risks already known to the team. F-05/F-06 (P1) are complete at the requirements level but were only high-level in the source PRD; some behavior here is [INFERRED] and should be confirmed by the PM. F-07/F-08 are functionally complete as *proposed* requirements but carry unresolved approval status (Open Decision 1) and depend most heavily on the still-unresolved schema/project-identity questions — no engineering commitment should be made on F-07/F-08 until Open Decisions 1–7 are resolved.

No requirement in this document overrides or is intended to alter any approved P0 requirement (REQ-P01–P06) or business rule (BR-001–BR-004) in the parent PRD.
