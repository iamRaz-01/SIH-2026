/**
 * src/api/aria.ts
 *
 * ARIA Web Intelligence API client — calls the new backend endpoints
 * added as part of the ARIA feature integration.
 *
 * Uses the same BASE_URL and apiFetch pattern as the existing client.ts.
 * All functions degrade gracefully: callers should handle rejected
 * promises (e.g. TAVILY_API_KEY not set → 500, project not found → 404).
 */

const DEFAULT_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? `http://${DEFAULT_HOST}:8000`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status} on ${path}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebEvidenceItem {
  evidence_id: string
  topic: string
  source: string
  url: string
  title: string | null
  publication_date: string | null
  date_confidence: 'VERIFIED' | 'UNVERIFIED'
  finding: string
  project_relevance: number
  trust_tier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'TIER_5'
  source_quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED'
}

export interface WebIntelligenceResponse {
  project_id: string
  project_name: string
  triggered: boolean
  trigger_reason: string
  topics_searched: string[]
  evidence_count: number
  evidence: WebEvidenceItem[]
  warnings: string[]
  searched_at: string
}

export interface AnalysisResponse {
  query: string
  project_id: string | null
  project_name: string | null
  intent: string
  text: string
  report: {
    executive_summary: string
    top_risk_drivers: { rank: number; driver: string; severity: string }[]
    recommended_monitoring_actions: { priority: string; action: string }[]
  }
  evidence: WebEvidenceItem[]
  status: string
}

// ── API Calls ─────────────────────────────────────────────────────────────────

/**
 * Ask the ARIA Coordinator a question (portfolio or project level).
 * @param query      The natural language question.
 * @param projectId  Optional project ID context.
 */
export function analyzeQuery(
  query: string,
  projectId?: string | null,
): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({
      query,
      project_id: projectId || undefined,
    }),
  })
}

/**
 * Run the Web Intelligence Agent for a project.
 * @param projectId  The project_id or project_code from the dataset.
 * @param force      Force a search even if risk is not HIGH/CRITICAL.
 */
export function getWebEvidence(
  projectId: string,
  force = false,
): Promise<WebIntelligenceResponse> {
  const qs = force ? '?force=true' : ''
  return apiFetch<WebIntelligenceResponse>(`/api/projects/${projectId}/web-evidence${qs}`)
}
