import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnomalies, type Anomaly, type AnomaliesResponse } from '../api/client'
import { Search, ExternalLink, LayoutGrid, List, Zap, ShieldCheck } from 'lucide-react'

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomaliesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('')
  const [quadrantFilter, setQuadrantFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
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
    if (s === 'CRITICAL') return 'badge-danger'
    if (s === 'HIGH') return 'badge-danger'
    if (s === 'MEDIUM') return 'badge-warning'
    return 'badge-unknown'
  }

  const formatCost = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val)) {
      return <span className="text-[#94A3B8] italic">Data unavailable</span>
    }
    return <span className="text-[#0F172A] font-semibold">₹{Number(val).toFixed(2)} Cr</span>
  }

  const formatPercent = (val?: number | null, suffix = '%') => {
    if (val === null || val === undefined || isNaN(val)) {
      return <span className="text-[#94A3B8] italic">Data unavailable</span>
    }
    return <span className="text-[#0F172A] font-semibold">{Number(val).toFixed(1)}{suffix}</span>
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#D97706]">Unsupervised Anomaly Detection</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1">Operational Outliers</h1>
          <p className="text-[#475569] text-[14px] font-normal mt-1">
            Multivariate behavioral outlier detection across budget variance, timeline delays, and expenditure velocity
          </p>
          {data?.detector_status && (
            <div className="flex flex-wrap items-center gap-4 mt-3 text-[13px] text-[#475569]">
              <span className="flex items-center gap-1.5 font-medium text-[#16A34A]">
                <ShieldCheck className="h-4 w-4" /> Active Isolation Forest
              </span>
              <span>Evaluated: <strong className="text-[#0F172A] font-semibold">{totalEvaluated.toLocaleString()}</strong></span>
              <span>Flagged Outliers: <strong className="text-[#B45309] font-semibold">{flaggedCount.toLocaleString()}</strong></span>
              {data.detector_status.critical_count != null && (
                <span>Critical: <strong className="text-[#B91C1C] font-semibold">{data.detector_status.critical_count}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#E2E8F0] p-1 rounded-xl shrink-0 shadow-2xs">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition ${
              viewMode === 'grid' ? 'bg-[#0F172A] text-[#FFFFFF] shadow-xs' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition ${
              viewMode === 'table' ? 'bg-[#0F172A] text-[#FFFFFF] shadow-xs' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <List className="h-4 w-4" />
            Table
          </button>
        </div>
      </div>

      {/* ── Filters Toolbar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            className="input w-full pl-10 text-[15px] placeholder:text-[15px]"
            placeholder="Search anomaly by name, code, state…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input text-[14px]"
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical Severity</option>
          <option value="HIGH">High Severity</option>
          <option value="MEDIUM">Medium Severity</option>
          <option value="LOW">Low Severity</option>
        </select>

        <select
          className="input text-[14px]"
          value={quadrantFilter}
          onChange={e => setQuadrantFilter(e.target.value)}
        >
          <option value="">All Quadrants</option>
          <option value="HIGH_RISK_ANOMALOUS">High Risk &amp; Anomalous</option>
          <option value="LOW_RISK_ANOMALOUS">Low Risk &amp; Anomalous</option>
          <option value="HIGH_RISK_NORMAL">High Risk Normal</option>
          <option value="NORMAL">Standard Execution</option>
        </select>

        <div className="flex items-center justify-end px-2">
          <label className="flex items-center gap-2 text-[13px] text-[#334155] cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              className="rounded bg-[#FFFFFF] border-[#CBD5E1] text-[#2563EB] focus:ring-0"
              checked={onlyFlagged}
              onChange={e => setOnlyFlagged(e.target.checked)}
            />
            Flagged Outliers Only
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 text-[#B91C1C] text-[14px]">
          {error}
        </div>
      )}

      {/* ── Cards Grid View ── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading && (
            <div className="col-span-full py-20 text-center text-[#64748B] flex items-center justify-center gap-2 text-[14px]">
              <div className="animate-spin h-5 w-5 border-2 border-[#2563EB] border-t-transparent rounded-full" />
              Scanning for operational anomalies…
            </div>
          )}

          {!loading && filteredAnomalies.map((a, i) => {
            const origCost = a.original_cost ?? a.relevant_project_metrics?.original_cost
            const revCost = a.revised_cost ?? a.relevant_project_metrics?.revised_cost
            const cumExp = a.cumulative_expenditure ?? a.relevant_project_metrics?.cumulative_expenditure
            const physProg = a.physical_progress ?? a.relevant_project_metrics?.physical_progress
            const covPct = a.cost_overrun_pct ?? a.relevant_project_metrics?.cost_overrun_pct
            const timePct = a.time_overrun_pct ?? a.relevant_project_metrics?.time_overrun_pct
            const timeMo = a.time_overrun_months ?? a.relevant_project_metrics?.time_overrun_months

            return (
              <div
                key={a.project_id || i}
                className="card-interactive p-5 flex flex-col justify-between space-y-4"
              >
                {/* Header & Badges */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={severityBadge(a.severity)}>
                      {a.severity || 'HIGH'} SEVERITY
                    </span>
                    <span className="text-[13px] font-medium text-[#475569] bg-[#F8FAFC] px-2.5 py-0.5 rounded border border-[#E2E8F0]">
                      Score: {((a.anomaly_score_norm ?? a.anomaly_score ?? 0.85) * 100).toFixed(0)}%
                    </span>
                  </div>

                  <h3 className="font-semibold text-[16px] text-[#0F172A] line-clamp-2 leading-snug">
                    <Link to={`/projects/${a.project_id}`} className="hover:text-[#2563EB]">
                      {a.project_name}
                    </Link>
                  </h3>
                  <p className="text-[12px] text-[#64748B] font-normal">Code: {a.project_code || a.project_id}</p>
                  <p className="text-[13px] text-[#475569] font-normal line-clamp-1">{a.agency} · {a.state}</p>
                </div>

                {/* Primary Financial & Schedule Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] text-[13px]">
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Original Cost</span>
                    <p className="mt-0.5">{formatCost(origCost)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#2563EB] uppercase font-semibold">Revised Cost</span>
                    <p className="mt-0.5">{formatCost(revCost)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Cumulative Spend</span>
                    <p className="mt-0.5">{formatCost(cumExp)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Physical Progress</span>
                    <p className="mt-0.5">{formatPercent(physProg)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Cost Overrun</span>
                    <p className="mt-0.5">
                      {covPct != null ? (
                        <span className={covPct > 30 ? 'text-[#B91C1C] font-semibold' : 'text-[#B45309] font-semibold'}>
                          +{covPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-[#94A3B8] italic">Data unavailable</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Time Overrun</span>
                    <p className="mt-0.5">
                      {timePct != null ? (
                        <span className="text-[#B45309] font-semibold">+{timePct.toFixed(1)}%</span>
                      ) : timeMo != null ? (
                        <span className="text-[#B45309] font-semibold">+{timeMo.toFixed(0)} Mo</span>
                      ) : <span className="text-[#94A3B8] italic">Data unavailable</span>}
                    </p>
                  </div>
                </div>

                {/* Behavioral Explanation Box */}
                <div className="bg-[#FFFBEB] border border-[#FDE68A] p-3 rounded-xl text-[13px] space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#B45309] uppercase tracking-wide">
                    <Zap className="h-3.5 w-3.5 text-[#D97706]" />
                    Anomaly Diagnosis
                  </div>
                  <p className="text-[13px] text-[#334155] leading-snug line-clamp-2 font-normal">
                    {a.explanation || a.anomaly_reason || 'Multivariate deviation across capital expenditure and progress indicators.'}
                  </p>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between">
                  <span className={`text-[12px] font-semibold uppercase tracking-wider ${
                    a.risk_status?.includes('High') ? 'text-[#B91C1C]' : 'text-[#B45309]'
                  }`}>
                    {a.risk_status || (a.is_anomaly ? 'ANOMALOUS' : 'NORMAL')}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setSelectedAnomaly(a)}
                      className="text-[13px] text-[#475569] hover:text-[#0F172A] font-medium"
                    >
                      Inspect
                    </button>
                    <Link
                      to={`/projects/${a.project_id}`}
                      className="text-[13px] text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1"
                    >
                      View Details <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}

          {!loading && !filteredAnomalies.length && (
            <div className="col-span-full py-16 text-center text-[#64748B] text-[14px]">
              No operational anomalies found matching the specified filters.
            </div>
          )}
        </div>
      )}

      {/* ── Table View ── */}
      {viewMode === 'table' && (
        <div className="card p-0 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <tr className="text-[#475569] text-left">
                  <th className="px-4 py-3.5 font-semibold">Severity</th>
                  <th className="px-4 py-3.5 font-semibold">Project &amp; Code</th>
                  <th className="px-4 py-3.5 font-semibold">Agency</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Original Cost</th>
                  <th className="px-4 py-3.5 font-semibold text-right text-[#2563EB]">Revised Cost</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Cost Overrun</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Physical Progress</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Score</th>
                  <th className="px-4 py-3.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {!loading && filteredAnomalies.map((a, i) => {
                  const origCost = a.original_cost ?? a.relevant_project_metrics?.original_cost
                  const revCost = a.revised_cost ?? a.relevant_project_metrics?.revised_cost
                  const covPct = a.cost_overrun_pct ?? a.relevant_project_metrics?.cost_overrun_pct
                  const physProg = a.physical_progress ?? a.relevant_project_metrics?.physical_progress

                  return (
                    <tr key={a.project_id || i} className="hover:bg-[#F8FAFC] transition">
                      <td className="px-4 py-3.5">
                        <span className={severityBadge(a.severity)}>
                          {a.severity || 'HIGH'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <Link to={`/projects/${a.project_id}`} className="font-semibold text-[#0F172A] hover:text-[#2563EB] line-clamp-1 transition text-[14px]">
                          {a.project_name}
                        </Link>
                        <p className="text-[#64748B] text-[12px] font-normal">Code: {a.project_code || a.project_id}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[#475569] max-w-[140px] truncate font-normal">{a.agency}</td>
                      <td className="px-4 py-3.5 text-right">{formatCost(origCost)}</td>
                      <td className="px-4 py-3.5 text-right">{formatCost(revCost)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {covPct != null ? (
                          <span className={covPct > 30 ? 'text-[#B91C1C] font-semibold' : 'text-[#B45309] font-semibold'}>
                            +{covPct.toFixed(1)}%
                          </span>
                        ) : <span className="text-[#94A3B8] italic">Data unavailable</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">{formatPercent(physProg)}</td>
                      <td className="px-4 py-3.5 text-center text-[#0F172A] font-medium">
                        {((a.anomaly_score_norm ?? a.anomaly_score ?? 0.85) * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link to={`/projects/${a.project_id}`} className="text-[#2563EB] hover:text-[#1D4ED8] p-1 inline-block">
                          <ExternalLink className="h-4 w-4" />
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

      {/* ── Inspection Modal ── */}
      {selectedAnomaly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className={severityBadge(selectedAnomaly.severity)}>
                  {selectedAnomaly.severity || 'HIGH'} ANOMALY
                </span>
                <h3 className="font-semibold text-[#0F172A] text-[18px] mt-2">
                  {selectedAnomaly.project_name}
                </h3>
                <p className="text-[12px] text-[#64748B] mt-0.5 font-normal">Code: {selectedAnomaly.project_code || selectedAnomaly.project_id}</p>
              </div>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FFFBEB] border border-[#FDE68A] p-4 rounded-xl space-y-1.5 text-[14px]">
              <p className="text-[#B45309] font-semibold uppercase tracking-wider text-[12px] flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[#D97706]" />
                Diagnostic Rationale
              </p>
              <p className="text-[#334155] leading-relaxed font-normal">
                {selectedAnomaly.explanation || selectedAnomaly.anomaly_reason}
              </p>
            </div>

            {/* Detected Indicators List */}
            {selectedAnomaly.detected_indicators && selectedAnomaly.detected_indicators.length > 0 && (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[#475569]">Contributing Outlier Indicators</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedAnomaly.detected_indicators.map((ind, i) => (
                    <div key={i} className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] flex items-center justify-between text-[13px]">
                      <span className="text-[#334155] font-medium">{ind.message}</span>
                      <span className="text-[#2563EB] font-semibold text-[13px] shrink-0 ml-2">
                        {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2">
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="btn-secondary text-[14px] font-medium"
              >
                Close
              </button>
              <Link
                to={`/projects/${selectedAnomaly.project_id}`}
                className="btn-primary text-[14px] font-semibold"
              >
                Open Project Page <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
