/**
 * InfraGuard AI — Centralised API client
 * All API calls go through this module. Base URL is read from VITE_API_BASE_URL.
 */

// Dynamic resolution: if VITE_API_BASE_URL is not set, use current hostname on port 8000
const DEFAULT_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? `http://${DEFAULT_HOST}:8000`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Health ─────────────────────────────────────────────────────────────────────
export const getHealth = () => apiFetch<HealthResponse>('/api/health');

// ── Projects ───────────────────────────────────────────────────────────────────
export const getProjects = (params?: ProjectsParams) => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.page_size) qs.set('page_size', String(params.page_size));
  if (params?.state) qs.set('state', params.state);
  if (params?.agency) qs.set('agency', params.agency);
  if (params?.risk) qs.set('risk', params.risk);
  if (params?.search) qs.set('search', params.search);
  return apiFetch<ProjectsResponse>(`/api/projects?${qs}`);
};

export const getProject = (id: string) =>
  apiFetch<Project>(`/api/projects/${id}`);

export const getProjectHistory = (id: string) =>
  apiFetch<ProjectHistoryResponse>(`/api/projects/${id}/history`);

// ── Dashboard ──────────────────────────────────────────────────────────────────
export const getDashboardSummary = () =>
  apiFetch<DashboardSummary>('/api/dashboard/summary');

export const getRiskDistribution = () =>
  apiFetch<RiskDistribution>('/api/dashboard/risk-distribution');

export const getStateAnalysis = () =>
  apiFetch<StateAnalysis>('/api/dashboard/state-analysis');

export const getAgencyAnalysis = () =>
  apiFetch<AgencyAnalysis>('/api/dashboard/sector-or-agency-analysis');

// ── Prediction & Explainability ────────────────────────────────────────────────
export const predictCostOverrun = (body: PredictRequest) =>
  apiFetch<PredictionResult>('/api/predict/cost-overrun', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const explainPrediction = (body: PredictRequest, topN = 6) =>
  apiFetch<ShapExplanationResult>(`/api/predict/explain?top_n=${topN}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ── Anomalies ──────────────────────────────────────────────────────────────────
export const getAnomalies = (params?: {
  limit?: number;
  only_flagged?: boolean;
  severity?: string;
  state?: string;
  agency?: string;
  quadrant?: string;
  page?: number;
  page_size?: number;
  search?: string;
}) => {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.page_size) qs.set('page_size', String(params.page_size));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.only_flagged) qs.set('only_flagged', 'true');
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.state) qs.set('state', params.state);
  if (params?.agency) qs.set('agency', params.agency);
  if (params?.quadrant) qs.set('quadrant', params.quadrant);
  return apiFetch<AnomaliesResponse>(`/api/anomalies?${qs}`);
};

export const getProjectAnomaly = (projectCode: string) =>
  apiFetch<AnomalyDetail>(`/api/anomalies/${projectCode}`);

// ── Risk & Benchmarking ────────────────────────────────────────────────────────
export const getProjectRisk = (projectCode: string) =>
  apiFetch<ProjectRiskEvaluation>(`/api/risk/${projectCode}`);

export const getPortfolioRiskIntelligence = () =>
  apiFetch<PortfolioRiskIntelligenceResponse>('/api/risk/portfolio-intelligence');

export const getProjectBenchmarks = (projectCode: string) =>
  apiFetch<ProjectBenchmarksResponse>(`/api/benchmarks/${projectCode}`);

// ── Network ────────────────────────────────────────────────────────────────────
export const getNetwork = (maxNodes = 250) =>
  apiFetch<NetworkResponse>(`/api/network?max_nodes=${maxNodes}`);

// ── Alerts (Top 5 for Notification Bell) ───────────────────────────────────────
export const getAlerts = (limit = 5) =>
  apiFetch<AlertsResponse>(`/api/alerts?limit=${limit}`);

// ── TypeScript interfaces ──────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  backend: string;
  app_name: string;
  app_version: string;
  dataset: { loaded: boolean; rows: number; columns: string[]; error: string | null };
  ml_model: {
    loaded: boolean;
    type: string | null;
    optimal_threshold: number | null;
    oof_metrics: Record<string, number>;
    trained_at: string | null;
    n_training_rows: number | null;
    error: string | null;
  };
  anomaly_detector: {
    fitted: boolean;
    total_projects?: number;
    total_evaluated?: number;
    flagged_count?: number;
    anomalies_flagged?: number;
    critical_count?: number;
    high_count?: number;
    algorithm?: string;
  };
  project_network: { built: boolean; total_nodes: number; total_edges: number };
}

export interface Project {
  project_id: string;
  project_name: string;
  agency: string;
  project_code?: string;
  state: string;
  doa?: string;
  original_target_doa?: string;
  revised_completion?: string;
  original_cost?: number | null;
  revised_cost?: number | null;
  cumulative_expenditure?: number | null;
  physical_progress?: number | null;
  edition?: string;
  cost_overrun_ratio?: number | null;
  cost_overrun_pct?: number | null;
  expenditure_ratio?: number | null;
  is_overrun?: number;
  time_overrun_months?: number | null;
  time_overrun_pct?: number | null;
  project_age_months?: number | null;
  [key: string]: unknown;
}

export interface ProjectsParams {
  page?: number;
  page_size?: number;
  state?: string;
  agency?: string;
  risk?: string;
  search?: string;
}

export interface ProjectsResponse {
  projects: Project[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardSummary {
  total_projects: number;
  latest_edition_projects?: number;
  latest_edition_label?: string;
  latest_edition_agencies?: number;
  latest_edition_states?: number;
  overrun_count: number;
  overrun_percentage: number;
  high_risk_projects: number;
  anomalous_projects: number;
  avg_physical_progress: number | null;
  avg_time_overrun_pct: number | null;
  avg_time_overrun_months: number | null;
  agencies_count: number;
  states_count: number;
}

export interface RiskBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface RiskDistribution {
  distribution: RiskBucket[];
  total: number;
}

export interface StateStats {
  state: string;
  project_count: number;
  avg_cost_overrun_ratio: number | null;
  avg_cost_overrun_pct: number | null;
  high_risk_count: number;
  avg_physical_progress: number | null;
}

export interface StateAnalysis {
  states: StateStats[];
  total_states: number;
}

export interface AgencyStats {
  agency: string;
  project_count: number;
  avg_cost_overrun_ratio: number | null;
  avg_cost_overrun_pct: number | null;
  avg_physical_progress: number | null;
}

export interface AgencyAnalysis {
  agencies: AgencyStats[];
  total_agencies: number;
}

export interface PredictRequest {
  project_id?: string;
  project_code?: string;
  edition?: string;
  project_name?: string;
  agency?: string;
  state?: string;
  doa?: string;
  original_target_doa?: string;
  original_cost?: number;
  cumulative_expenditure?: number;
  physical_progress?: number;
}

export interface TopFeature {
  feature: string;
  value: unknown;
  label: string;
  numeric_value: number | null;
}

export interface ShapFeature {
  feature: string;
  label: string;
  value: number | null;
  shap_value: number;
  impact: 'INCREASES_RISK' | 'DECREASES_RISK' | 'NEUTRAL';
  magnitude: number;
  explanation: string;
}

export interface PredictionResult {
  project_id?: string;
  project_code?: string;
  project_name?: string;
  agency?: string;
  state?: string;
  risk_class?: 'Low' | 'Medium' | 'High' | 'Unknown';
  risk_level?: string;
  probability: number | null;
  cost_overrun_probability?: number | null;
  predicted_overrun?: boolean;
  prediction?: string;
  confidence: 'High' | 'Medium' | 'Low';
  status: 'Scored' | 'Insufficient Data';
  top_features: TopFeature[];
  model_type: string;
  optimal_threshold: number;
  model_metrics?: { roc_auc?: number; pr_auc?: number };
  missing_fields?: string[];
  provenance?: string;
}

export interface ShapExplanationResult extends PredictionResult {
  base_value_log_odds: number;
  explanation_method: string;
  summary: string;
  top_contributing_features: ShapFeature[];
}

export interface DetectedIndicator {
  type: string;
  severity: string;
  message: string;
  metric: string;
  value: number;
}

export interface Anomaly {
  project_id: string;
  project_code?: string;
  project_name: string;
  agency: string;
  state: string;
  original_cost?: number | null;
  revised_cost?: number | null;
  cumulative_expenditure?: number | null;
  physical_progress?: number | null;
  cost_overrun_pct?: number | null;
  time_overrun_months?: number | null;
  time_overrun_pct?: number | null;
  anomaly_score: number;
  anomaly_score_norm: number;
  raw_anomaly_score?: number;
  is_anomaly: number | boolean;
  anomaly_status?: string;
  severity?: string;
  risk_quadrant?: string;
  risk_status?: string;
  anomaly_reason: string;
  explanation?: string;
  detected_indicators?: DetectedIndicator[];
  relevant_project_metrics?: {
    original_cost?: number | null;
    revised_cost?: number | null;
    cumulative_expenditure?: number | null;
    physical_progress?: number | null;
    expenditure_ratio?: number | null;
    cost_overrun_pct?: number | null;
    time_overrun_months?: number | null;
    time_overrun_pct?: number | null;
    project_age_months?: number | null;
  };
}

export interface AnomalyDetail extends Anomaly {
  feature_deviations?: Array<{
    feature: string;
    label: string;
    project_value: number;
    dataset_median: number;
    z_score: number;
    is_deviant: boolean;
  }>;
}

export interface AnomaliesResponse {
  anomalies: Anomaly[];
  total_returned?: number;
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  detector_status?: {
    fitted: boolean;
    total_projects?: number;
    total_evaluated?: number;
    flagged_count?: number;
    anomalies_flagged?: number;
    critical_count?: number;
    high_count?: number;
    algorithm?: string;
    error: string | null;
  };
}

export interface ProjectRiskEvaluation {
  project_code: string;
  project_id: string;
  project_name: string;
  agency: string;
  state: string;
  overall_risk: {
    score: number;
    level: string;
    provenance: string;
  };
  model_output: {
    prediction: string;
    cost_overrun_probability: number | null;
    risk_level: string;
    confidence: string;
    provenance: string;
  };
  derived_analytics: {
    cost_risk: { score: number; level: string; cost_overrun_pct: number | null };
    schedule_risk: { score: number; level: string; time_overrun_months: number | null };
    implementation_indicators: { score: number; level: string; physical_progress_ratio: number | null };
    anomaly_status: { status: string; score: number; severity: string; is_anomaly: boolean; explanation: string };
    provenance: string;
  };
}

export interface ProjectBenchmarksResponse {
  project_code: string;
  project_name: string;
  agency: string;
  state: string;
  scale_bucket: string;
  project_metrics: Record<string, number | null>;
  benchmarks: Record<string, {
    name: string;
    filter_type: string;
    filter_value: string;
    cohort_size: number;
    statistics: Record<string, {
      label: string;
      average: number | null;
      median: number | null;
      p25: number | null;
      p75: number | null;
      project_value: number | null;
      project_percentile: number | null;
    }>;
  }>;
}

export interface NetworkNode {
  id: string;
  project_code?: string;
  project_name: string;
  label: string;
  agency: string;
  state: string;
  original_cost: number | null;
  revised_cost: number | null;
  cumulative_expenditure?: number | null;
  physical_progress: number | null;
  cost_overrun_pct?: number | null;
  time_overrun_months?: number | null;
  time_overrun_pct?: number | null;
  is_anomaly: number;
  anomaly_status?: string;
  risk_class: string;
  degree: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface NetworkEdge {
  source: string | NetworkNode;
  target: string | NetworkNode;
  weight: number;
  reasons: string[];
}

export interface NetworkResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    hub_projects: string[];
    avg_degree: number;
  };
  trimmed_to?: number;
  error?: string;
}

export interface Alert {
  id?: string;
  project_id: string;
  project_code: string;
  project_name: string;
  agency: string;
  state: string;
  severity: 'High' | 'Medium' | 'Informational' | string;
  severity_code?: 'high' | 'medium' | 'info';
  priority_rank?: number;
  title: string;
  message: string;
  metric_responsible: string;
  metric_value: string;
  date?: string | null;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
}

export interface RiskScatterPoint {
  project_id: string;
  project_code: string;
  project_name: string;
  project_value: number;
  risk_pct: number;
  cost_overrun_pct: number | null;
  time_overrun_months: number | null;
  physical_progress: number | null;
  risk_class: 'High' | 'Medium' | 'Low';
  agency: string;
  state: string;
  is_anomaly: boolean;
}

export interface CostDriver {
  feature: string;
  label: string;
  importance: number;
  raw_gain?: number;
}

export interface SectorRiskItem {
  sector: string;
  risk_pct: number;
  total_projects: number;
  high_risk_projects: number;
  avg_cost_overrun_pct: number;
}

export interface InterventionPriorityItem {
  rank: number;
  project_id: string;
  project_code: string;
  project_name: string;
  agency: string;
  state: string;
  project_value: number;
  risk_pct: number;
  cost_overrun_pct: number;
  time_overrun_months: number | null;
  physical_progress: number;
  is_anomaly: boolean;
  anomaly_status: string;
  priority_level: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  priority_score?: number;
}

export interface PortfolioRiskIntelligenceResponse {
  summary: {
    high_risk_projects: number;
    high_risk_percentage: number;
    predicted_cost_exposure: number;
    schedule_risk_percentage: number;
    portfolio_risk_indicator: number;
  };
  scatter_points: RiskScatterPoint[];
  cost_drivers: CostDriver[];
  sector_risk: SectorRiskItem[];
  intervention_priorities: InterventionPriorityItem[];
}

export interface ProjectHistoryRecord {
  edition?: string;
  edition_date?: string;
  edition_label?: string;
  original_cost: number | null;
  revised_cost: number | null;
  cumulative_expenditure: number | null;
  physical_progress: number | null;
  cost_overrun_pct: number | null;
  time_overrun_months: number | null;
  original_target_doa?: string | null;
  revised_completion?: string | null;
  is_anomaly?: number | boolean;
  cost_growth?: number | null;
  expenditure_ratio?: number | null;
}

export interface HistoryMilestone {
  date: string;
  type: 'COST_REVISION' | 'TARGET_EXTENSION' | 'PROGRESS_SURGE' | string;
  title: string;
  detail: string;
}

export interface ProjectHistoryResponse {
  project_code: string;
  project_id: string;
  project_name: string;
  agency: string;
  state: string;
  timeline_count: number;
  has_history: boolean;
  summary: {
    first_edition: string | null;
    latest_edition: string | null;
    initial_cost: number;
    latest_cost: number;
    cost_growth_cr: number;
    cost_growth_pct: number;
    initial_progress: number;
    latest_progress: number;
    progress_gain_pp: number;
    initial_expenditure: number;
    latest_expenditure: number;
    expenditure_growth_cr: number;
    progress_velocity_monthly_pp: number;
  };
  milestones: HistoryMilestone[];
  history: ProjectHistoryRecord[];
}
