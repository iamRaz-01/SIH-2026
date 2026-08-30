import { useEffect, useState } from 'react'
import { getAnomalies, type Anomaly, type AnomaliesResponse } from '../api/client'
import { Zap, Info } from 'lucide-react'

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomaliesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('')
  const [quadrantFilter, setQuadrantFilter] = useState('')
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAnomalies({
      limit: 100,
      only_flagged: onlyFlagged,
      severity: severityFilter || undefined,
      quadrant: quadrantFilter || undefined,
    })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [onlyFlagged, severityFilter, quadrantFilter])

  const totalEvaluated =
    data?.detector_status?.total_projects ??
    data?.detector_status?.total_evaluated ??
    0

  const flaggedCount =
    data?.detector_status?.flagged_count ??
    data?.detector_status?.anomalies_flagged ??
    0

  const severityBadge = (sev?: string) => {
    const s = String(sev || 'LOW').toUpperCase()
    if (s === 'CRITICAL') return 'bg-red-900/60 text-red-300 border border-red-700'
    if (s === 'HIGH') return 'bg-amber-900/60 text-amber-300 border border-amber-700'
    if (s === 'MEDIUM') return 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50'
    return 'bg-gray-800 text-gray-400 border border-gray-700'
  }

  const quadrantBadge = (quad?: string) => {
    const q = String(quad || '')
    if (q === 'HIGH_RISK_ANOMALOUS') return 'bg-purple-950/70 text-purple-300 border border-purple-800'
    if (q === 'HIGH_RISK_NORMAL') return 'bg-red-950/70 text-red-300 border border-red-800'
    if (q === 'LOW_RISK_ANOMALOUS') return 'bg-amber-950/70 text-amber-300 border border-amber-800'
    return 'bg-emerald-950/50 text-emerald-300 border border-emerald-800'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-400" />
            Intelligent Anomaly Detection
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            USP #1 — Unsupervised Isolation Forest on expenditure, progress, and cost-revision patterns
          </p>
          {data?.detector_status && (
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                Detector: <span className="text-emerald-400 font-semibold">{data.detector_status.fitted ? '✓ Active (Isolation Forest)' : '✗ Not fitted'}</span>
              </span>
              <span>Total evaluated: <span className="text-gray-200 font-semibold">{totalEvaluated.toLocaleString()}</span></span>
              <span>Flagged anomalies: <span className="text-amber-400 font-bold">{flaggedCount.toLocaleString()}</span></span>
              {data.detector_status.critical_count != null && (
                <span>Critical: <span className="text-red-400 font-bold">{data.detector_status.critical_count}</span></span>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded bg-gray-800 border-gray-700 text-amber-500 focus:ring-0"
              checked={onlyFlagged}
              onChange={e => setOnlyFlagged(e.target.checked)}
            />
            Flagged only
          </label>

          <select
            className="input text-xs py-1 px-2.5 h-8 bg-gray-800"
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            className="input text-xs py-1 px-2.5 h-8 bg-gray-800"
            value={quadrantFilter}
            onChange={e => setQuadrantFilter(e.target.value)}
          >
            <option value="">All 4 Quadrants</option>
            <option value="HIGH_RISK_ANOMALOUS">High Risk + Anomalous</option>
            <option value="HIGH_RISK_NORMAL">High Risk + Normal</option>
            <option value="LOW_RISK_ANOMALOUS">Low Risk + Anomalous</option>
            <option value="LOW_RISK_NORMAL">Low Risk + Normal</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-900/60">
              <tr className="text-gray-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Project</th>
                <th className="text-left px-4 py-3 font-medium">Agency & State</th>
                <th className="text-center px-4 py-3 font-medium">Severity</th>
                <th className="text-center px-4 py-3 font-medium">Risk Quadrant</th>
                <th className="text-right px-4 py-3 font-medium">Anomaly Score</th>
                <th className="text-left px-4 py-3 font-medium">Operational Explanation</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                      Evaluating Isolation Forest behavioral distributions…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data?.anomalies?.map((a: Anomaly, i) => {
                const scoreNorm = (a.anomaly_score_norm ?? a.anomaly_score ?? 0) * 100
                const isFlagged = Boolean(a.is_anomaly)
                const reason = a.explanation || a.anomaly_reason || 'Standard operational distribution.'
                const code = a.project_code || a.project_id

                return (
                  <tr
                    key={a.project_id || i}
                    onClick={() => setSelectedAnomaly(a)}
                    className={`border-b border-gray-800/40 hover:bg-gray-800/40 cursor-pointer transition ${
                      isFlagged ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-gray-200 font-medium line-clamp-2 max-w-xs">{a.project_name}</p>
                      <p className="text-gray-500 font-mono text-[11px] mt-0.5">Code: {code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300 text-xs">{a.agency}</p>
                      <p className="text-gray-500 text-xs">{a.state}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadge(a.severity)}`}>
                        {a.severity || (isFlagged ? 'HIGH' : 'LOW')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${quadrantBadge(a.risk_quadrant)}`}>
                        {a.risk_quadrant ? a.risk_quadrant.replace(/_/g, ' ') : 'LOW RISK NORMAL'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${scoreNorm > 70 ? 'bg-red-400' : scoreNorm > 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(scoreNorm, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-200 font-mono text-xs w-10 text-right">
                          {scoreNorm.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-sm">
                      <p className="line-clamp-2">{reason}</p>
                    </td>
                  </tr>
                )
              })}
              {!loading && !data?.anomalies?.length && (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-gray-500">
                    No anomalies matching the selected filters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Anomaly Modal / Detail Card */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadge(selectedAnomaly.severity)}`}>
                  {selectedAnomaly.severity || 'ANOMALOUS'}
                </span>
                <h2 className="text-lg font-bold text-gray-100 mt-2">{selectedAnomaly.project_name}</h2>
                <p className="text-xs text-gray-400">{selectedAnomaly.agency} · {selectedAnomaly.state} · Code: {selectedAnomaly.project_code || selectedAnomaly.project_id}</p>
              </div>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-gray-400 hover:text-gray-100 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 space-y-2">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="h-4 w-4 text-amber-400" />
                Detected Operational Diagnostic
              </p>
              <p className="text-sm text-gray-200">{selectedAnomaly.explanation || selectedAnomaly.anomaly_reason}</p>
            </div>

            {selectedAnomaly.relevant_project_metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-gray-800/30 p-2.5 rounded-lg border border-gray-800">
                  <p className="text-gray-500">Sanctioned Cost</p>
                  <p className="font-semibold text-gray-200 mt-0.5">
                    {selectedAnomaly.relevant_project_metrics.original_cost != null ? `₹${selectedAnomaly.relevant_project_metrics.original_cost} Cr` : '—'}
                  </p>
                </div>
                <div className="bg-gray-800/30 p-2.5 rounded-lg border border-gray-800">
                  <p className="text-gray-500">Expenditure</p>
                  <p className="font-semibold text-gray-200 mt-0.5">
                    {selectedAnomaly.relevant_project_metrics.cumulative_expenditure != null ? `₹${selectedAnomaly.relevant_project_metrics.cumulative_expenditure} Cr` : '—'}
                  </p>
                </div>
                <div className="bg-gray-800/30 p-2.5 rounded-lg border border-gray-800">
                  <p className="text-gray-500">Physical Progress</p>
                  <p className="font-semibold text-gray-200 mt-0.5">
                    {selectedAnomaly.relevant_project_metrics.physical_progress != null ? `${selectedAnomaly.relevant_project_metrics.physical_progress}%` : '—'}
                  </p>
                </div>
                <div className="bg-gray-800/30 p-2.5 rounded-lg border border-gray-800">
                  <p className="text-gray-500">Expenditure Ratio</p>
                  <p className="font-semibold text-gray-200 mt-0.5">
                    {selectedAnomaly.relevant_project_metrics.expenditure_ratio != null ? `${(selectedAnomaly.relevant_project_metrics.expenditure_ratio * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="btn-ghost text-xs px-4 py-2"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
