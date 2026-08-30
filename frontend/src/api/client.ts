/**
 * InfraGuard AI — Centralised API client
 * All API calls go through this module. Base URL is read from VITE_API_BASE_URL.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

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

// ── Dashboard ──────────────────────────────────────────────────────────────────
export const getDashboardSummary = () =>
  apiFetch<DashboardSummary>('/api/dashboard/summary');

export const getRiskDistribution = () =>
  apiFetch<RiskDistribution>('/api/dashboard/risk-distribution');

export const getStateAnalysis = () =>
  apiFetch<StateAnalysis>('/api/dashboard/state-analysis');

export const getAgencyAnalysis = () =>
  apiFetch<AgencyAnalysis>('/api/dashboard/sector-or-agency-analysis');

// ── Prediction ─────────────────────────────────────────────────────────────────
export const predictCostOverrun = (body: PredictRequest) =>
  apiFetch<PredictionResult>('/api/predict/cost-overrun', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ── Anomalies ──────────────────────────────────────────────────────────────────
export const getAnomalies = (params?: { limit?: number; only_flagged?: boolean }) => {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.only_flagged) qs.set('only_flagged', 'true');
  return apiFetch<AnomaliesResponse>(`/api/anomalies?${qs}`);
};

// ── Network ────────────────────────────────────────────────────────────────────
export const getNetwork = (maxNodes = 200) =>
  apiFetch<NetworkResponse>(`/api/network?max_nodes=${maxNodes}`);

// ── Alerts ─────────────────────────────────────────────────────────────────────
export const getAlerts = (limit = 20) =>
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
  anomaly_detector: { fitted: boolean; total_projects: number; flagged_count: number };
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
  original_cost?: number;
  revised_cost?: number;
  cumulative_expenditure?: number;
  physical_progress?: number;
  edition?: string;
  cost_overrun_ratio?: number;
  expenditure_ratio?: number;
  is_overrun?: number;
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
  overrun_count: number;
  overrun_percentage: number;
  avg_cost_overrun_ratio: number | null;
  avg_physical_progress: number | null;
  total_revised_cost_crore: number | null;
  total_original_cost_crore: number | null;
  high_risk_projects: number;
  medium_risk_projects: number;
  low_risk_projects: number;
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
  total_revised_cost_crore: number | null;
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
  total_revised_cost_crore: number | null;
  avg_physical_progress: number | null;
}

export interface AgencyAnalysis {
  agencies: AgencyStats[];
  total_agencies: number;
}

export interface PredictRequest {
  project_id?: string;
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

export interface PredictionResult {
  project_id?: string;
  project_name?: string;
  agency?: string;
  state?: string;
  risk_class: 'Low' | 'Medium' | 'High' | 'Unknown';
  probability: number | null;
  predicted_overrun?: boolean;
  confidence: 'High' | 'Medium' | 'Low';
  status: 'Scored' | 'Insufficient Data';
  top_features: TopFeature[];
  model_type: string;
  optimal_threshold: number;
  model_metrics?: { roc_auc?: number; pr_auc?: number };
  missing_fields?: string[];
}

export interface Anomaly {
  project_id: string;
  project_name: string;
  agency: string;
  state: string;
  anomaly_score: number;
  anomaly_score_norm: number;
  is_anomaly: number;
  anomaly_reason: string;
}

export interface AnomaliesResponse {
  anomalies: Anomaly[];
  total_returned: number;
  detector_status: {
    fitted: boolean;
    total_projects: number;
    flagged_count: number;
    error: string | null;
  };
}

export interface NetworkNode {
  id: string;
  label: string;
  agency: string;
  state: string;
  original_cost: number | null;
  revised_cost: number | null;
  cost_overrun_ratio: number | null;
  physical_progress: number | null;
  is_anomaly: number;
  risk_class: string;
  degree: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
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
  project_id: string;
  project_name: string;
  agency: string;
  state: string;
  alert_type: string;
  severity: string;
  message: string;
  cost_overrun_ratio: number | null;
  physical_progress: number | null;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
}
