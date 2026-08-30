import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnomalies, type Anomaly, type AnomaliesResponse } from '../api/client'
import { AlertOctagon, Search, ExternalLink, Activity, LayoutGrid, List } from 'lucide-react'

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomaliesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('')
  const [quadrantFilter, setQuadrantFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

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
    if (s === 'CRITICAL') return 'bg-red-950/80 text-red-300 border border-red-800'
    if (s === 'HIGH') return 'bg-amber-950/80 text-amber-300 border border-amber-800'
    if (s === 'MEDIUM') return 'bg-yellow-950/60 text-yellow-300 border border-yellow-800/60'
    return 'bg-gray-800/80 text-gray-400 border border-gray-700'
  }

  const formatCost = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val)) {
      return <span className="text-gray-500 italic">Data unavailable</span>
    }
    return <span className="text-gray-100 font-semibold">₹{Number(val).toFixed(2)} Cr</span>
  }

  const formatPercent = (val?: number | null, suffix = '%') => {
    if (val === null || val === undefined || isNaN(val)) {
      return <span className="text-gray-500 italic">Data unavailable</span>
    }
    return <span className="text-gray-100 font-semibold">{Number(val).toFixed(1)}{suffix}</span>
  }

  // Filter by local search query
  const filteredAnomalies = (data?.anomalies || []).filter(a => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (a.project_name || '').toLowerCase().includes(q) ||
      (a.project_code || '').toLowerCase().includes(q) ||
      (a.agency || '').toLowerCase().includes(q) ||
      (a.state || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header (Zero USP text) */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <AlertOctagon className="h-6 w-6 text-amber-400" />
            Anomalies
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Operational deviations and behavioral outlier analysis across cost, schedule, and expenditure rates
          </p>
          {data?.detector_status && (
            <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                Status: <span className="text-emerald-400 font-semibold">Active Detector</span>
              </span>
              <span>Total Evaluated: <strong className="text-gray-200">{totalEvaluated.toLocaleString()}</strong></span>
              <span>Flagged Anomalies: <strong className="text-amber-400 font-bold">{flaggedCount.toLocaleString()}</strong></span>
              {data.detector_status.critical_count != null && (
                <span>Critical: <strong className="text-red-400 font-bold">{data.detector_status.critical_count}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              viewMode === 'grid' ? 'bg-gray-800 text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              viewMode === 'table' ? 'bg-gray-800 text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-900/60 p-3.5 rounded-2xl border border-gray-800/80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="input w-full pl-9 text-xs"
            placeholder="Search project name, code, state…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input text-xs"
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
        >
          <option value="">All Severity Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          className="input text-xs"
          value={quadrantFilter}
          onChange={e => setQuadrantFilter(e.target.value)}
        >
          <option value="">All Risk Quadrants</option>
          <option value="HIGH_RISK_ANOMALOUS">High Risk + Anomalous</option>
          <option value="HIGH_RISK_NORMAL">High Risk + Normal</option>
          <option value="LOW_RISK_ANOMALOUS">Low Risk + Anomalous</option>
          <option value="LOW_RISK_NORMAL">Low Risk + Normal</option>
        </select>

        <div className="flex items-center justify-end px-2">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded bg-gray-800 border-gray-700 text-amber-500 focus:ring-0"
              checked={onlyFlagged}
              onChange={e => setOnlyFlagged(e.target.checked)}
            />
            Show Flagged Outliers Only
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full" />
            <span className="text-sm">Evaluating operational behavioral metrics…</span>
          </div>
        </div>
      )}

      {/* ── CARD GRID VIEW (Requirement #1) ── */}
      {!loading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAnomalies.map((item: Anomaly, index) => {
            const pCode = item.project_code || item.project_id || 'N/A'
            const origCost = item.original_cost ?? item.relevant_project_metrics?.original_cost
            const revCost = item.revised_cost ?? item.relevant_project_metrics?.revised_cost
            const spend = item.cumulative_expenditure ?? item.relevant_project_metrics?.cumulative_expenditure
            const prog = item.physical_progress ?? item.relevant_project_metrics?.physical_progress
            const covPct = item.cost_overrun_pct ?? item.relevant_project_metrics?.cost_overrun_pct
            const timePct = item.time_overrun_pct ?? item.relevant_project_metrics?.time_overrun_pct
            const anomScorePct = (item.anomaly_score_norm ?? item.anomaly_score ?? 0) * 100
            const isFlagged = Boolean(item.is_anomaly)
            const riskSt = item.risk_status || (covPct && covPct > 30 ? 'High Risk' : covPct && covPct > 10 ? 'Medium Risk' : 'Low Risk')

            return (
              <div
                key={item.project_id || index}
                className={`bg-gray-900/90 border rounded-2xl p-5 flex flex-col justify-between transition hover:border-gray-700 shadow-lg ${
                  isFlagged ? 'border-amber-900/60 bg-amber-950/10' : 'border-gray-800'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadge(item.severity)}`}>
                        {item.severity || (isFlagged ? 'HIGH' : 'LOW')}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                        {riskSt}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-950 px-2 py-0.5 rounded border border-gray-800">
                      Score: {anomScorePct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Project Name & Code */}
                  <h3 className="font-bold text-gray-100 text-sm leading-snug line-clamp-2" title={item.project_name}>
                    {item.project_name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-1 pb-3 border-b border-gray-800/70">
                    <span>Code: <strong className="text-gray-300 font-mono">{pCode}</strong></span>
                    <span className="truncate max-w-[150px]">{item.state}</span>
                  </div>

                  {/* Agency */}
                  <p className="text-[11px] text-gray-500 mt-2 line-clamp-1">
                    Agency: <span className="text-gray-400">{item.agency}</span>
                  </p>

                  {/* Comprehensive Financial & Operational Metrics */}
                  <div className="grid grid-cols-2 gap-2.5 mt-3.5 bg-gray-950/60 p-3 rounded-xl border border-gray-800/80 text-xs">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Original Cost</p>
                      <p className="mt-0.5">{formatCost(origCost)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Revised Cost</p>
                      <p className="mt-0.5">{formatCost(revCost)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Cumulative Spend</p>
                      <p className="mt-0.5">{formatCost(spend)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Physical Progress</p>
                      <p className="mt-0.5">{formatPercent(prog, '%')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Cost Overrun</p>
                      <p className="mt-0.5">
                        {covPct != null ? (
                          <span className={`font-semibold ${covPct > 30 ? 'text-red-400' : covPct > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {covPct > 0 ? `+${covPct.toFixed(1)}%` : `${covPct.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Data unavailable</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Time Overrun</p>
                      <p className="mt-0.5">
                        {timePct != null ? (
                          <span className={`font-semibold ${timePct > 20 ? 'text-red-400' : 'text-gray-200'}`}>
                            +{timePct.toFixed(1)}%
                          </span>
                        ) : item.time_overrun_months != null ? (
                          <span className="text-gray-200 font-semibold">{item.time_overrun_months} Mo</span>
                        ) : (
                          <span className="text-gray-500 italic">Data unavailable</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Operational Reason */}
                  <p className="text-[11px] text-gray-400 mt-3 line-clamp-2 leading-relaxed bg-gray-900 p-2.5 rounded-lg border border-gray-800/60">
                    {item.explanation || item.anomaly_reason || 'Standard operational parameters within cohort median.'}
                  </p>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-gray-500">
                    Status: <strong className={isFlagged ? 'text-amber-400' : 'text-emerald-400'}>{item.anomaly_status || 'NORMAL'}</strong>
                  </span>
                  <Link
                    to={`/projects/${item.project_id || item.project_code}`}
                    className="text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1 transition"
                  >
                    Details <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {!loading && viewMode === 'table' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-800 bg-gray-900/80">
                <tr className="text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Project Name &amp; Code</th>
                  <th className="px-4 py-3 font-medium">Agency &amp; State</th>
                  <th className="px-4 py-3 font-medium text-right">Original Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Revised Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Spend</th>
                  <th className="px-4 py-3 font-medium text-right">Progress</th>
                  <th className="px-4 py-3 font-medium text-right">Cost Overrun</th>
                  <th className="px-4 py-3 font-medium text-right">Time Overrun</th>
                  <th className="px-4 py-3 font-medium text-center">Score</th>
                  <th className="px-4 py-3 font-medium text-center">Risk</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filteredAnomalies.map((item, index) => {
                  const origCost = item.original_cost ?? item.relevant_project_metrics?.original_cost
                  const revCost = item.revised_cost ?? item.relevant_project_metrics?.revised_cost
                  const spend = item.cumulative_expenditure ?? item.relevant_project_metrics?.cumulative_expenditure
                  const prog = item.physical_progress ?? item.relevant_project_metrics?.physical_progress
                  const covPct = item.cost_overrun_pct ?? item.relevant_project_metrics?.cost_overrun_pct
                  const timePct = item.time_overrun_pct ?? item.relevant_project_metrics?.time_overrun_pct

                  return (
                    <tr key={item.project_id || index} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-semibold text-gray-200 line-clamp-1">{item.project_name}</p>
                        <p className="text-gray-500 font-mono text-[10px]">Code: {item.project_code || item.project_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-300 line-clamp-1">{item.agency}</p>
                        <p className="text-gray-500 text-[10px]">{item.state}</p>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCost(origCost)}</td>
                      <td className="px-4 py-3 text-right">{formatCost(revCost)}</td>
                      <td className="px-4 py-3 text-right">{formatCost(spend)}</td>
                      <td className="px-4 py-3 text-right">{formatPercent(prog, '%')}</td>
                      <td className="px-4 py-3 text-right">
                        {covPct != null ? (
                          <span className={covPct > 30 ? 'text-red-400 font-semibold' : 'text-gray-200'}>
                            {covPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Data unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {timePct != null ? (
                          <span className="text-gray-200 font-semibold">{timePct.toFixed(1)}%</span>
                        ) : (
                          <span className="text-gray-500 italic">Data unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-gray-300">
                          {((item.anomaly_score_norm ?? item.anomaly_score ?? 0) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadge(item.severity)}`}>
                          {item.severity || 'LOW'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/projects/${item.project_id || item.project_code}`} className="text-brand-400 hover:text-brand-300">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !filteredAnomalies.length && (
        <div className="card text-center py-16 text-gray-500 space-y-2">
          <Activity className="h-8 w-8 mx-auto text-gray-600 mb-2" />
          <p className="text-sm text-gray-300 font-semibold">No matching anomaly records found</p>
          <p className="text-xs text-gray-500">Try adjusting your severity, quadrant, or search filters.</p>
        </div>
      )}
    </div>
  )
}
