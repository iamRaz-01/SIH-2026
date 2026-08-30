# PROJECT CONTEXT — SIH26103 / Infrastructure Predictive Monitoring
*Living context document. Source-of-truth confidence markers used throughout: 🟢 Confirmed · 🔵 Decided · 🟡 Inferred · 🟠 Assumption · 🔴 Unknown · ⚠️ Conflicting*

---

## 1. PROJECT IDENTITY

**Project Name:** Not yet formally decided by the team. Working name "InfraGuard AI" has appeared in solution-direction discussion only — 🔵 this is a proposed working label, not a confirmed project name.

**Problem Statement (official wording, preserved):**
> "The Infrastructure & Project Monitoring Division (IPMD), Ministry of Statistics and Programme Implementation (MoSPI) monitors the Central Sector Infrastructure Projects costing ₹150 crore and above... While the existing PAIMANA framework provides robust capabilities for monitoring and reporting project progress, there is a growing need to move beyond descriptive monitoring towards predictive and prescriptive monitoring... the proposed use-case seeks to develop an AI-powered Predictive Analytics and Early Warning System capable of analysing the large volume of project data available at PAIMANA portal, using Open-Source Tools and Softwares, to identify projects that are likely to experience cost escalation, schedule delays and implementation risks before such issues materialise."

**One-Line Problem Interpretation:** MoSPI already records what's happening on ~2,000 large infrastructure projects every month; it does not yet forecast what's *about to* happen — the PS asks for a predictive/prescriptive layer on top of the existing descriptive monitoring system.

**Domain:** Public infrastructure project monitoring / government project-portfolio analytics (Central Sector infrastructure projects, India).

**Organization / Department:** MoSPI — Data Informatics & Innovation Division (DIID); the operational owner of the underlying data system is IPMD (Infrastructure & Project Monitoring Division).

**PS Identifier:** SIH26103. Category: Software. Theme: Smart Automation.

**Project Status:** 🔵 Problem Understanding / Data Acquisition phase — historical data collection is underway (manual, 5+ years); solution design has been discussed directionally but not finalized as an approved architecture.

---

## 2. PROBLEM DEFINITION 🔎

**Core Problem:** Overrun/delay detection in India's Central Sector infrastructure portfolio is retrospective — MoSPI's monitoring stack (OCMS → PAIMANA) captures and reports status after the fact, with no predictive layer that flags risk before it shows up as a materialized cost or schedule overrun in the monthly figures. 🟢 Confirmed — this is the PS's own stated gap.

**Root Causes (🟢 Confirmed — sourced from MoSPI Flash Reports and parliamentary answers, not derived by inference):**
- Delays in land acquisition
- Delays in forest/environment clearances
- Delays in project financing tie-up
- Under-estimation of original project cost
- Scope changes during implementation
- Tendering/procurement/equipment-supply delays
- Contractual issues
- Foreign exchange and statutory duty rate changes
- General price rise / material cost escalation

Note (🟡 Inferred, but strongly evidenced): most of these root causes are *not* directly represented as CUF fields — CUF captures financial/physical-progress consequences (cost, expenditure, progress %) rather than the upstream administrative causes themselves. This is the real-world basis for why PS dimension (c) — CUF sufficiency — is a genuine open question rather than a formality.

**Current Situation:** See Section 9 (Current-State Context) for full detail. Summary: monthly self-reported CUF submissions by Project Implementing Agencies (PIAs) → OCMS/PAIMANA aggregation → dashboards and Flash Reports → periodic review via PRAGATI (PMO-level) and PMG (cross-agency escalation body). 🟢 Confirmed.

**Consequences:** Recurring, large-scale cost overruns — figures in the multiple-lakh-crore range have appeared in nearly every publicly available monthly Flash Report over the past decade (examples found: ~₹2.16 lakh crore, Feb 2018; ~₹4.80 lakh crore, Jan 2024; ~₹4.92 lakh crore, June 2026). 🟢 Confirmed via multiple independent published reports — this is a structural, recurring pattern, not a one-off.

**Why It Matters:** The monitored portfolio is ~₹42.78 lakh crore in revised cost across 1,981 projects, 17 ministries, 22 sectors (as of the PS's April 2026 reference point) — a scale directly tied to national public capital expenditure outcomes and to PMO-level review mechanisms (PRAGATI). 🟢 Confirmed.

**Scope (PS-defined):** Central Sector infrastructure projects costing ₹150 crore and above, currently tracked on PAIMANA/OCMS. Analytical focus: cost overrun, time/schedule overrun, and general implementation risk prediction. 🟢 Confirmed.

**Out of Scope (established in conversation, not merely inferred):**
- Rebuilding PAIMANA's existing descriptive/reporting capability as the primary deliverable — 🔵 Decided; this duplicates an existing, working system and does not answer the PS's stated gap.
- A general-purpose government data-entry/administration system (upload approval workflows, full role-based access control, audit logging) as a core build target — 🔵 Decided; acceptable only as a brief "would sit behind RBAC in production" note, not a build item.
- Full 2006–present historical depth if bridging the OCMS→PAIMANA schema transition proves unreliable — 🔵 Decided; a smaller, schema-consistent panel is preferred over a longer but structurally uncertain one.

---

## 3. STAKEHOLDER MODEL 👥

| Stakeholder | Role | Needs | Pain Points | Evidence |
|---|---|---|---|---|
| IPMD / MoSPI (DIID) | PS issuer, system owner | Reliable, actionable early-warning signal | Currently owns a system that explains overruns only after they occur | 🟢 Confirmed (PS text) |
| Line Ministries (17, e.g. MoRTH, Railways, Coal) | Data consumers, accountable for project delivery | Ministry-specific risk visibility before escalation | Bear public/parliamentary accountability for overruns with limited predictive tooling | 🟢 Confirmed (PS + Flash Report structure) |
| Project Implementing Agencies (PIAs) | Monthly CUF data submitters | Reporting process that doesn't add burden | Manual, self-reported monthly submission; root causes (land/clearance) often outside their direct control | 🟢 Confirmed (CUF/OCMS process is documented) |
| PMG (Project Monitoring Group) | Cross-agency escalation/resolution body | Prioritized list of which projects need attention now | Reviews are periodic, not continuous or predictive | 🟢 Confirmed (PMG's documented review cadence) |
| PRAGATI (PMO-level review) | High-level political escalation mechanism | Same as PMG, at higher stakes | Same reactive-cadence limitation | 🟢 Confirmed |
| DPIIT (IPMP/PAIMANA-CRIP integration partner) | Co-owner of API data pipeline ("One Data, One Entry") | Standardized fields across systems | CUF/field standardization still evolving as of 2024–2026 | 🟢 Confirmed (PIB releases) |
| Contractors / financing banks & FIs | Execution/financing counterparts | Visibility into risk before contractual/financial exposure grows | Not formally represented in PMG proceedings despite bearing execution/financing risk | 🟢 Confirmed (cited in PMG-reform commentary) |
| Citizens / end users of infrastructure | Ultimate beneficiaries | Timely delivery of public infrastructure | Delayed access to roads/rail/power/water when projects overrun | 🟡 Inferred (standard downstream-impact reasoning, not directly stated in PS) |
| Hackathon team | Solution builder | Access to sufficient, real historical data | Confirmed: no bulk dataset provided; manual collection required | 🔵 Decided/established in-conversation |

**Most consequential stakeholder for scoping decisions:** IPMD/MoSPI — because they define what counts as credible and actionable, which determines whether any model output would actually be used. 🟡 Inferred conclusion, not stated in PS.

---

## 4. DOMAIN CONTEXT 🌐

**Key terminology (preserved from official sources):**
- **OCMS** — Online Computerised Monitoring System, MoSPI's original project-monitoring platform, operational since 2006.
- **PAIMANA** — Project Assessment, Infrastructure Monitoring and Analytics for Nation-building; OCMS's modernized successor, formally launched September 2025.
- **CUF** — Common Upload Form; the standardized monthly data-submission form used by PIAs, jointly maintained with DPIIT's IPMP/PAIMANA-CRIP integration.
- **IPMD** — Infrastructure & Project Monitoring Division (MoSPI's internal unit operating this system).
- **DIID** — Data Informatics & Innovation Division (the PS-issuing department).
- **PMG** — Project Monitoring Group; cross-agency body for resolving stuck approvals/clearances.
- **PRAGATI** — Pro-Active Governance and Timely Implementation; PMO-level periodic project review mechanism.
- **Flash Report** — MoSPI's monthly published summary report (aggregate + project-wise tables) on the monitored portfolio.
- **NIE-I** — National Infrastructure Enablement Index; a related but distinct state-level (not project-level) benchmarking framework, aligned with PAIMANA. 🟢 Confirmed, noted as adjacent, not part of this PS's scope.

**Relevant processes:** Monthly CUF submission → OCMS/PAIMANA ingestion (increasingly API-automated) → Flash Report generation → dashboard/indicator reporting → PRAGATI/PMG review cycles. 🟢 Confirmed.

**Relevant regulation/policy context:** "One Data, One Entry" integration principle between MoSPI/PAIMANA and DPIIT's project-monitoring systems. 🟢 Confirmed (PIB press releases, 2024–2026).

---

## 5. CURRENT-STATE CONTEXT 🔍

**Existing Process (🟢 Confirmed):**
1. PIA submits monthly CUF data (cost, expenditure, physical progress, schedule/milestone status).
2. Data flows into OCMS/PAIMANA — a growing share (documented ~64% for select ministries as of a Jan 2026 release) is auto-fetched via API rather than manually entered.
3. MoSPI compiles the monthly Flash Report (aggregate figures + project-wise tables).
4. Dashboards, including a 165-indicator NIPFP-designed Performance Monitoring framework, present current/historical status.
5. Delayed or overrun projects surface for review through PRAGATI and PMG.

**Existing Systems:** PAIMANA (current), OCMS (legacy/pre-Sept 2025), DPIIT's IPMP/PAIMANA-CRIP (integration layer), PRAGATI, PMG. 🟢 Confirmed.

**Current Limitations (🟢 Confirmed, PS's own framing):** The system is descriptive/reporting-oriented; no predictive/forecasting layer exists on top of it, per the PS's explicit problem statement.

**Known Gaps (🟢 Confirmed via MoSPI's own reports):** Documented data-quality issues exist independent of any modeling effort — a notable number of monitored projects historically lack reported commissioning year or gestation period; agencies have historically under-reported revised cost estimates and commissioning schedules. Any project built on this data must account for this, not assume a clean dataset.

**Existing Workarounds:** 🔴 Unknown — no source describes how MoSPI or line ministries currently compensate for the lack of a predictive layer (e.g., informal escalation triggers, manual project-officer judgment). Not established by available sources.

---

## 6. REQUIREMENT CONTEXT 📋

### Explicit Requirements (directly stated in PS)

```text
REQ-001
Description: Develop and evaluate statistical/predictive models forecasting cost overruns, time overruns, and implementation risks.
Source: PS, technical dimension (a)
Status: Confirmed

REQ-002
Description: Assess whether AI/ML techniques provide significant gains over conventional statistical methods (prediction accuracy, early-warning capability, decision support).
Source: PS, technical dimension (b)
Status: Confirmed

REQ-003
Description: Build models based on existing CUF fields, and separately assess how much predictive performance is attributable to CUF fields vs. additional variables not currently captured in CUF.
Source: PS, technical dimension (c)
Status: Confirmed

REQ-004
Description: Use only open-source tools/software.
Source: PS, explicit constraint statement
Status: Confirmed
```

### Derived Requirements (logically necessary, not directly stated)

```text
REQ-005
Description: A statistical baseline model must be built and compared against ML models with reported metrics — required to satisfy REQ-002 meaningfully.
Source: Derived from REQ-002
Status: Derived

REQ-006
Description: Data-leakage prevention — only pre-outcome information may be used to predict an outcome.
Source: Derived from REQ-001/002 (methodological necessity for any credible predictive claim)
Status: Derived

REQ-007
Description: Model outputs must be explainable at the individual-project level (why a project is flagged).
Source: Derived from the stakeholder need for decision-support usable by non-ML policymakers
Status: Derived
```

### Team Decisions (explicitly made in conversation)

```text
REQ-008
Description: Historical data will be manually collected from official MoSPI sources spanning 5+ years (OCMS-era and PAIMANA-era), rather than relying on a bulk export.
Source: Team decision, in-conversation
Status: Confirmed (decision), execution status open — see Open Questions

REQ-009
Description: No automated scraping of the live PAIMANA portal (paimana-proj.mospi.gov.in) or its PDF report archive — site disallows automated access via robots.txt.
Source: Verified directly (fetch attempts returned ROBOTS_DISALLOWED) + team decision to respect this boundary
Status: Confirmed
```

### Open Requirements

```text
REQ-010
Description: Final usable panel size (months × projects with clean, continuous history) is not yet determined.
Source: Depends on resolution of Open Question OQ-001/OQ-002
Status: Open
```

---

## 7. CONSTRAINTS ⚠️

| Constraint | Category | Source | Severity | Status |
|---|---|---|---|---|
| Open-source tools/software only | Business/Organizational (PS mandate) | PS explicit text | High | Confirmed |
| No bulk historical dataset or API provided by organizers | Data | Verified — PS dataset link is a report page, not a download | Critical | Confirmed |
| Live PAIMANA portal and PDF archive are robots.txt-disallowed for automated access | Technical/Data | Verified directly via fetch attempts | Critical | Confirmed |
| CUF field schema is itself still under active revision by MoSPI/DPIIT (as of 2024–2026 year-end review) | Data/Domain | PIB year-end review release | Medium | Confirmed |
| Historical data spans two system generations (OCMS pre-Sept 2025, PAIMANA after) with unconfirmed schema compatibility | Data | Team-identified risk | High | Potential Constraint — validation pending |
| Project identity (ID/name) continuity across years not yet confirmed | Data | Team-identified risk | High | Potential Constraint — validation pending |
| Documented missing/underreported fields in MoSPI's own historical data (commissioning year, gestation period, revised estimates) | Data quality | MoSPI's own Flash Report commentary | Medium | Confirmed |
| No stated evaluation rubric, accuracy threshold, or defined success metric in the PS itself | Requirement clarity | PS text (absence noted) | Medium | Confirmed (as an absence) |
| Hackathon timeframe (implicit) | Time | 🟠 Assumption — standard SIH-scale hackathon, not explicitly stated in materials reviewed | Medium | Potential Constraint |

---

## 8. DATA CONTEXT 📊

| Data | Source | Availability | Confidence | Notes |
|---|---|---|---|---|
| Monthly Flash Report (aggregate + project-wise tables) | MoSPI IPMD, published at ipm.mospi.gov.in / paimana-proj.mospi.gov.in | Public, but site is robots.txt-disallowed for automated pulls | 🟢 Confirmed | Individual monthly PDFs found via search follow a predictable naming pattern (e.g., `FlashReport_<Month>_<Year>.pdf`); human/manual download is not blocked, only automated crawling |
| Row-level historical OCMS/PAIMANA database (bulk export/API) | MoSPI IPMD | Not provided to the team | 🟢 Confirmed absent | PS dataset link points only to the report page, not a downloadable file |
| Team-compiled historical panel (5+ years, manual collection) | Team's own manual collection effort, sourced from official monthly reports | In progress | 🔵 Decided/underway | Schema-mapping and project-ID continuity across the OCMS→PAIMANA boundary not yet verified (see Open Questions) |
| DPIIT IPMP/PAIMANA-CRIP API | DPIIT + MoSPI, government-to-government | Not confirmed accessible to external/hackathon participants | 🔴 Unknown | No evidence found of a public-facing API for this integration layer |
| data.gov.in structured infrastructure-overrun dataset | NIC/MoSPI (potential) | Not confirmed to exist in usable form | 🔴 Unknown | Searched; no confirmed structured downloadable dataset found, only news/report references |
| Prior academic MOSPI-derived dataset (1992–2009 study) | Independent researchers | Exists as a research artifact, not a shared public file | 🟡 Inferred | Useful precedent that manual reconstruction from Flash Reports has been done before; the dataset itself not confirmed obtainable |

**Privacy considerations:** Low — this is public infrastructure expenditure data, not personal data. 🟡 Inferred, consistent with the nature of the data described in all sources reviewed.

---

## 9. EXISTING SOLUTION LANDSCAPE 🌍

| Solution | Organization | What It Does | Relevance | Known Gap | Source Confidence |
|---|---|---|---|---|---|
| PAIMANA / OCMS | MoSPI | Central repository + dashboards for project status | This *is* the PS's data source and the system being extended | Descriptive, not predictive (per PS's own framing) | 🟢 Confirmed |
| PRAGATI | PMO/Government of India | High-level periodic review of stalled projects | Downstream consumer of any predictive/risk signal | Periodic/reactive cadence, not continuous | 🟢 Confirmed |
| PMG | Cross-ministry body | Resolves stuck approvals/clearances | Same as above | Bank/contractor stakeholders not formally represented | 🟢 Confirmed |
| DPIIT IPMP / PAIMANA-CRIP | DPIIT + MoSPI | Standardizes "one data one entry" across monitoring systems | Determines what fields are structurally available to any model | Integration/standardization still evolving | 🟢 Confirmed |
| NIE-I | MoSPI, NIPFP-aligned | State-level infrastructure readiness benchmarking | Adjacent domain, different granularity (state vs. project) | Not project-level, not predictive | 🟢 Confirmed |
| Academic ML overrun-prediction studies (Jordan, Croatia, generic ANN models) | Various universities/publishers | Demonstrate ML techniques (CatBoost, ANN, ensemble models) applied to construction cost/time overrun prediction | Methodological reference for algorithm choice and achievable-metric benchmarking | Non-Indian datasets, small samples (81–191 projects), different regulatory/institutional context; not applied to MoSPI data | 🟢 Confirmed as existing research; 🟡 relevance to this specific dataset is inferred, not proven |
| 1992–2009 MOSPI-derived academic study | Independent researchers | Built a structured dataset directly from historical MOSPI Flash Report data | Direct precedent that manual dataset reconstruction from Flash Reports is a proven approach | Pre-PAIMANA, statistical (not ML) methods, ends 2009 | 🟢 Confirmed to exist |

No confirmed open-source GitHub project or commercial product specifically modeling MoSPI/OCMS/PAIMANA data was found. 🔴 Unknown/not found — absence noted, not proof of nonexistence.

---

## 10. RESEARCH KNOWLEDGE 📚

```text
Finding: The monitored portfolio (per PS reference point) is 1,981 projects, 17 ministries, 22 sectors, ~₹42.78 lakh crore revised cost.
Source: Official PS text, corroborated by MoSPI PIB releases.
What it tells us: Establishes the scale and stakes of the problem.
Relevance: Grounds the "why it matters" narrative; not directly needed for modeling.
Confidence: 🟢 Confirmed

Finding: Cost overrun figures have recurred in the multiple-lakh-crore range across nearly every publicly available monthly report over roughly the past decade.
Source: Multiple independent published Flash Report summaries (2018, 2020, 2024, 2026 figures found).
What it tells us: The problem is structural/recurring, not episodic — supports framing this as a persistent institutional gap rather than a one-time anomaly.
Relevance: Strengthens real-world-impact framing; also implies enough historical signal likely exists across years for a trend-based model, if the data itself is obtainable.
Confidence: 🟢 Confirmed

Finding: Root causes of overruns (land acquisition, clearances, financing, scope changes, procurement delays, contractual issues) are consistently reported by PIAs across years, per MoSPI's own disclosures.
Source: MoSPI Flash Report commentary and parliamentary (Lok Sabha) answers.
What it tells us: Most stated root causes are administrative/coordination issues largely outside what CUF fields directly capture.
Relevance: Directly informs why PS dimension (c) — CUF sufficiency — is a real open question, not a formality.
Confidence: 🟢 Confirmed

Finding: MoSPI's own reports acknowledge missing/underreported data for a substantial number of monitored projects (commissioning year, gestation period, revised estimates).
Source: MoSPI Flash Report text itself.
What it tells us: The dataset the team is compiling will inherently be noisy/incomplete — this is a known, government-acknowledged property of the data, not a team data-collection failure.
Relevance: Any model built on this data must be designed and presented with this caveat.
Confidence: 🟢 Confirmed

Finding: Peer-reviewed ML studies on construction cost/time overrun prediction (non-Indian datasets) report a wide range of achievable accuracy, including at least one very high (~99.7%) reported accuracy figure that is plausibly inflated by overfitting on a small dataset.
Source: Multiple academic publications (Emerald/ECAM, Springer Asian Journal of Civil Engineering, ResearchGate).
What it tells us: High reported accuracy numbers in this literature should be treated with skepticism, especially given MoSPI's own smaller, noisier dataset.
Relevance: Sets realistic expectations for model performance and signals what a knowledgeable evaluator might question.
Confidence: 🟢 Confirmed (findings exist); 🟡 the overfitting interpretation is a reasoned inference, not stated by the papers themselves.

Finding: The live PAIMANA portal (paimana-proj.mospi.gov.in) and the older ipm.mospi.gov.in domain (including individual PDF report files) return ROBOTS_DISALLOWED on automated fetch attempts.
Source: Direct verification (tool-based fetch attempts within this project).
What it tells us: Automated scraping of this data source is against the site's stated policy.
Relevance: Directly shapes the team's data-acquisition method (manual collection, not automated scraping).
Confidence: 🟢 Confirmed (directly tested, not inferred from search results).
```

---

## 11. PROJECT DECISION LOG 🧭

| Decision | Reason | Source/Conversation Context | Status |
|---|---|---|---|
| The solution must include a genuine predictive/forecasting layer, not primarily re-present current status | PS's own explicit "descriptive → predictive/prescriptive" framing | Established early in problem-understanding discussion | Confirmed |
| A statistical-baseline-vs-ML comparison is a required deliverable, not optional | PS dimension (b) is explicit | Direct PS reading | Confirmed |
| A CUF-only-vs-CUF+expanded-features comparison is a required deliverable | PS dimension (c) is explicit | Direct PS reading | Confirmed |
| Historical data will be manually collected (5+ years, OCMS + PAIMANA era) rather than relying on a provided bulk dataset | No bulk dataset/API was provided; live-site scraping is disallowed | Confirmed in conversation ("we are collecting the Data manually... for 5+ years") | Confirmed |
| No automated scraping of the live PAIMANA/OCMS site will be attempted | robots.txt disallows it; verified directly | Direct tool-based verification in this project | Confirmed |
| A full government data-entry/admin-approval system (RBAC, audit logs, upload workflows) is deprioritized to a one-line mention, not a build target | Does not address the PS's predictive/prescriptive mandate; scope-creep risk identified | Team discussion evaluating an early solution draft | Confirmed |
| USP/innovation-layer features (e.g., anomaly detection, project-network/relationship analysis) are explicitly excluded from this Project Context document | Team requested the context be limited to PS-grounded scope only | Explicit user instruction ("i need only the Project Context not include our usp Features") | Confirmed |
| Full 2006–present historical depth is not required if the OCMS→PAIMANA schema transition cannot be reliably bridged; a smaller, schema-consistent panel is acceptable | Defensibility over raw depth | Team discussion on data acquisition scoping | Confirmed |

*No previous decision has been reversed; this log reflects the current, unbroken decision state.*

---

## 12. ASSUMPTION REGISTER 🟡

| Assumption | Why We Believe It | Risk | Validation Needed |
|---|---|---|---|
| A hackathon-scale (limited) build timeframe applies | Standard for SIH-format problem statements; not explicitly stated in reviewed materials | Medium — affects how much of REQ-001–003 can realistically be delivered | Confirm actual timeline/milestones from official SIH schedule |
| The team's manually-collected 5+ year panel will yield a usable sample size once cleaned | Manual collection is underway and described as spanning both OCMS and PAIMANA eras | High — the entire predictive/temporal-validation approach depends on this holding true | Complete OQ-001 and OQ-002 (schema mapping, project-ID continuity checks) |
| Citizens/end-users are an appropriate secondary stakeholder to consider | Standard downstream-impact reasoning for public infrastructure delays | Low | Not critical to validate; doesn't affect technical scope |
| No hidden bulk dataset exists that could be requested directly from MoSPI/organizers via an official Q&A channel | No such channel result has been checked/reported in this conversation | Medium — if a bulk dataset does exist and could be requested, the manual-collection effort may be partly unnecessary | Check official SIH clarification/Q&A channel directly |

---

## 13. UNKNOWN / OPEN QUESTION REGISTER ❓

```text
OQ-001
Question: Do OCMS-era (pre-Sept 2025) report fields map cleanly onto current PAIMANA/CUF fields, or is there a schema seam that breaks continuity?
Why it matters: Determines how much of the 5+ years of manually collected data is actually usable as a single consistent panel.
What source could answer it: Side-by-side comparison of one OCMS-era report and one recent PAIMANA-era report, done by the team.
Priority: 🔴 Critical

OQ-002
Question: Are project identifiers/names consistent across years, or is fuzzy-matching (name + ministry + sanctioned cost) required to track a single project's trajectory over time?
Why it matters: Determines feasibility of true per-project time-series modeling vs. only repeated cross-sectional snapshots.
What source could answer it: Direct check across a sample of the collected reports by the team.
Priority: 🔴 Critical

OQ-003
Question: What is the final usable panel size (number of months × number of projects with continuous, clean history) once OQ-001/OQ-002 are resolved?
Why it matters: Determines what validation strategy (true temporal split vs. cross-sectional only) is honestly achievable, and what should be claimed in any presentation.
What source could answer it: Direct output of the team's own data-cleaning process, dependent on OQ-001/OQ-002.
Priority: 🟠 High

OQ-004
Question: Is there an official SIH clarification/Q&A channel through which a bulk historical dataset or API could be formally requested from MoSPI?
Why it matters: Could materially reduce the manual-collection burden if such a channel exists and yields a response.
What source could answer it: SIH organizer communication channel (not yet checked in this conversation).
Priority: 🟡 Medium

OQ-005
Question: What specific evaluation rubric or success threshold (if any) will judges apply to dimensions (b) and (c)?
Why it matters: The PS states these as required comparisons but gives no defined "significant gains" threshold.
What source could answer it: Official SIH evaluation criteria, if published, or direct organizer clarification.
Priority: 🟡 Medium
```

---

## 14. SOURCE CONFLICT REGISTER ⚔️

No direct factual conflicts between sources have been identified so far. One near-conflict worth tracking:

| Topic | Source A | Source B | Conflict | Resolution |
|---|---|---|---|---|
| Exact portfolio figures (project count, revised cost) | PS text: 1,981 projects, ~₹42.78 lakh crore (April 2026 reference) | Various PIB releases across different months report different counts (e.g., 1,847 projects/₹40.54 lakh crore in June 2026; 1,987 projects/₹42.50 lakh crore in May 2026) | Not a true conflict — these are different monthly snapshots of a naturally changing portfolio, not contradictory claims about the same point in time | Use the PS's own stated figures (April 2026 reference point) as the canonical numbers for this project; treat other months' figures only as evidence of the recurring-overrun pattern, not as competing "current" numbers |

---

## 15. PROJECT VOCABULARY 📖

| Term | Meaning in This Project | Source |
|---|---|---|
| CUF | Common Upload Form — the standardized monthly data-submission form PIAs use to report project status | MoSPI/DPIIT documentation |
| OCMS | Online Computerised Monitoring System — MoSPI's original (2006–2025) project-monitoring platform | PS text, PIB releases |
| PAIMANA | Project Assessment, Infrastructure Monitoring and Analytics for Nation-building — OCMS's 2025 successor platform | PS text, PIB releases |
| PIA | Project Implementing Agency — the entity responsible for executing a monitored project and submitting its monthly CUF data | Domain research |
| PMG | Project Monitoring Group — cross-agency body resolving stuck clearances/approvals for delayed projects | Domain research |
| PRAGATI | Pro-Active Governance and Timely Implementation — PMO-level periodic review mechanism | Domain research |
| Flash Report | MoSPI's monthly published summary of the monitored project portfolio (aggregate + project-wise tables) | PS text, PIB releases |
| Descriptive monitoring | Reporting/dashboarding what has already happened or the current status | PS text (explicit contrast term) |
| Predictive/prescriptive monitoring | Forecasting what is likely to happen, and supporting a decision about what to do — the PS's stated target capability | PS text (explicit) |
| Early-warning lead time | The amount of time before a materialized overrun/delay that a system's prediction would have flagged the risk | Team-adopted evaluation concept, derived from PS's "before such issues materialise" language |

---

## 16. PROJECT BOUNDARIES 🚧

**In Scope:**
- Predictive modeling of cost overrun, time/schedule overrun, and general implementation risk, using project-level historical data.
- Statistical-baseline-vs-ML comparison (PS dimension b).
- CUF-only-vs-CUF+expanded-variables comparison (PS dimension c).
- A dashboard/interface surfacing predictions, risk scores, and early warnings (not primarily current-status reporting).
- An LLM-based assistant that explains/retrieves the system's own predictions and data (explicitly required by the PS's outcome list, not a differentiator).
- Explainability of individual risk predictions.

**Out of Scope (explicitly established):**
- A general-purpose government data administration/RBAC/audit system as a core build target.
- Re-presenting PAIMANA's existing descriptive capability as the primary deliverable.
- Full 2006–present depth if the OCMS→PAIMANA schema boundary cannot be reliably bridged.
- Innovation/USP-layer features (anomaly detection, project-network/relationship analysis) — excluded from this document per explicit team instruction; not evaluated here as in- or out-of-scope for the overall project, only excluded from this particular context artifact.

**Unknown Scope:**
- Whether survival-analysis or other longitudinal-specific modeling techniques are viable — depends entirely on the outcome of OQ-001/OQ-002/OQ-003 (data continuity and volume).
- Whether benchmarking/comparative analytics (PS outcome e) will be a standalone module or a feature embedded within the dashboard — not yet decided.
- Final deployment/documentation framework expectations (PS outcome i) — not yet discussed in conversation.

---

## 17. CONTEXT CONFIDENCE MAP 📊

| Area | Confidence | Reason |
|---|---|---|
| Problem | 🟢 High | Directly and explicitly stated in the PS; corroborated by extensive independent research |
| Stakeholders | 🟢 High | Primary stakeholders well-evidenced; secondary/citizen-level impact is reasonably inferred, not PS-stated |
| Domain | 🟢 High | Terminology and system landscape thoroughly verified across multiple official/government sources |
| Requirements | 🟢 High | Explicit requirements are directly quoted from PS; derived requirements are methodologically sound |
| Constraints | 🟡 Medium | Most constraints confirmed directly; two (schema drift, project-ID continuity) remain unvalidated potential constraints |
| Data | 🟠 Low-Medium | Data source landscape well understood, but the single most important number — actual usable panel size — is not yet known |
| Existing Systems | 🟢 High | PAIMANA/OCMS/PRAGATI/PMG landscape thoroughly verified |
| Research | 🟢 High | Multiple independent academic and government sources reviewed and cross-checked |
| Scope | 🟢 High | In-scope/out-of-scope boundaries have been explicitly discussed and decided, not merely assumed |

**The 3 areas where project understanding is weakest:**
1. **Data (actual usable panel size)** — the single highest-risk unknown; nothing about modeling approach can be finalized until OQ-001/OQ-002/OQ-003 resolve.
2. **Constraints from schema drift** — directly downstream of the data unknown above.
3. **Evaluation criteria (OQ-005)** — the PS asks for comparisons but provides no stated threshold for what counts as "significant," leaving the bar for success partly undefined.

---

## 18. PROJECT CONTEXT SUMMARY 🧠

```text
PROJECT:
SIH26103 — Predictive/prescriptive layer for MoSPI's Central Sector infrastructure project monitoring (PAIMANA/OCMS ecosystem). Working name "InfraGuard AI" proposed, not finalized.

PROBLEM:
PAIMANA/OCMS monitors ~1,981 Central Sector infrastructure projects (₹150 Cr+) but is descriptive-only — no predictive layer exists to flag cost/schedule overrun risk before it materializes in monthly reported figures.

PRIMARY USERS:
MoSPI/IPMD (system owner), line ministries and their PIAs (data providers, accountable parties), PMG and PRAGATI (escalation/review bodies) as consumers of any risk signal.

DOMAIN:
Indian public infrastructure project monitoring / government project-portfolio analytics.

CORE OBJECTIVE:
Build predictive models (cost overrun, time overrun, implementation risk) that (a) meaningfully outperform a conventional statistical baseline, and (b) honestly quantify how much predictive power comes from existing CUF fields vs. additional variables not currently captured.

KEY REQUIREMENTS:
Predictive modeling (REQ-001); stat-vs-ML comparison (REQ-002); CUF-vs-expanded comparison (REQ-003); open-source tools only (REQ-004); data-leakage prevention (REQ-006); per-project explainability (REQ-007).

KEY CONSTRAINTS:
No bulk historical dataset/API provided; live PAIMANA/OCMS site is robots.txt-disallowed for automated access; CUF schema itself still evolving; unconfirmed schema/ID continuity across the OCMS→PAIMANA transition; MoSPI's own historical data has documented missingness.

KNOWN DATA:
Public monthly Flash Reports (human-downloadable, not machine-scrapable) are the only confirmed source; team is manually compiling a 5+ year historical panel from these; no row-level bulk export or API access confirmed.

EXISTING SYSTEMS:
PAIMANA (current), OCMS (legacy), DPIIT IPMP/PAIMANA-CRIP (integration layer), PRAGATI, PMG, NIE-I (adjacent, state-level, not in scope).

IMPORTANT RESEARCH:
Recurring multi-lakh-crore overruns across a decade of Flash Reports confirm this is a structural, not episodic, problem. Documented root causes (land acquisition, clearances, financing) are largely outside CUF fields, grounding the PS's own dimension (c) as a genuine question. Academic ML-overrun literature exists but uses small, non-Indian datasets — useful methodologically, not a performance guarantee; at least one very high reported accuracy figure (~99.7%) should be treated with skepticism as a possible overfitting artifact. Live-site scraping is directly confirmed disallowed (robots.txt).

TEAM DECISIONS:
Predictive layer (not re-descriptive dashboard) is the core deliverable; both PS comparisons (b, c) are mandatory and must be reported honestly; manual 5+ year data collection is underway; no automated scraping of the live government site; admin/RBAC system deprioritized; USP/innovation-layer features intentionally excluded from this context document.

ASSUMPTIONS:
Hackathon-scale limited timeframe applies (not explicitly confirmed); the manually-collected panel will yield a usable sample once cleaned (not yet verified); no hidden bulk dataset is obtainable via direct request (not yet checked).

UNKNOWN:
Whether OCMS/PAIMANA field schemas map cleanly across years (OQ-001); whether project identity is consistent across years (OQ-002); the resulting final usable panel size (OQ-003); whether a formal data request channel exists (OQ-004); what evaluation threshold judges will apply to dimensions (b)/(c) (OQ-005).

OPEN QUESTIONS:
See Section 13 in full — five open questions registered, two rated Critical (OQ-001, OQ-002).

CURRENT PROJECT STATUS:
Problem understanding is complete and well-evidenced. Data acquisition (manual historical collection) is in progress but not yet validated for schema/ID continuity. Solution architecture has been discussed directionally but is not yet a finalized, approved design.

HIGHEST-RISK UNKNOWN:
Whether the manually-collected 5+ year historical panel is actually usable as a single, schema-consistent, project-trackable time series (OQ-001 + OQ-002 combined) — every downstream claim about temporal prediction, early-warning lead time, and the honesty of the stat-vs-ML and CUF-vs-expanded comparisons depends on this resolving favorably.
```

---

*This document reflects project understanding as of the current conversation. No solution architecture, feature set, or USP content is included by design — see Decision Log, row 6. Update per the protocol: identify what's new, compare against existing context, update only affected sections, preserve decision history.*
