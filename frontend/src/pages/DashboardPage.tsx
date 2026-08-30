import { useEffect, useState } from 'react'
import {
  getDashboardSummary,
  getRiskDistribution,
  getStateAnalysis,
  getAgencyAnalysis,
  type DashboardSummary,
  type RiskDistribution,
  type StateAnalysis,
  type AgencyAnalysis,
} from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Building2, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, AlertCircle,
} from 'lucide-react'

const RISK_COLORS: Record<string, string> = {
  'High Risk (>30%)':     '#ef4444',
  'Medium Risk (10-30%)': '#f59e0b',
  'Low Risk (0-10%)':     '#22c55e',
  'Under Budget (<0%)':   '#3b82f6',
  'High (>30%)':          '#ef4444',
  'Medium (10-30%)':      '#f59e0b',
  'Low (0-10%)':          '#22c55e',
  'Under Budget':         '#3b82f6',
}

function StatCard({
  icon: Icon, label, value, sub, color = 'text-gray-100'
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="card flex items-start gap-4 p-4 border border-gray-800/80 bg-gray-900/60 shadow-lg">
      <div className="bg-gray-800/80 rounded-xl p-2.5 shrink-0 border border-gray-700/50">
        <Icon className="h-5 w-5 text-brand-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 tracking-tight ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [riskDist, setRiskDist] = useState<RiskDistribution | null>(null)
  const [stateData, setStateData] = useState<StateAnalysis | null>(null)
  const [agencyData, setAgencyData] = useState<AgencyAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getDashboardSummary(),
      getRiskDistribution(),
      getStateAnalysis(),
      getAgencyAnalysis(),
    ])
      .then(([s, r, st, ag]) => {
        setSummary(s)
        setRiskDist(r)
        setStateData(st)
        setAgencyData(ag)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="animate-spin h-10 w-10 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="bg-red-950/50 border border-red-800 rounded-xl p-6 text-red-400">
        <p className="font-bold">Failed to load dashboard</p>
        <p className="text-sm mt-1">{error}</p>
        <p className="text-sm mt-2 text-red-500">Make sure the backend is running on port 8000.</p>
      </div>
    </div>
  )

  const topStates = stateData?.states.slice(0, 10) ?? []
  const topAgencies = agencyData?.agencies.slice(0, 10) ?? []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Portfolio Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          Central Sector Infrastructure Monitoring · Ministry of Statistics &amp; Programme Implementation (MoSPI)
        </p>
      </div>

      {/* Reorganized Administrative KPI Cards (Removed: Avg Cost Overrun, Med Risk, Low Risk, Total Revised Cost) */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon={Building2}
            label="Total Projects"
            value={summary.total_projects.toLocaleString()}
            sub={`${summary.agencies_count} agencies · ${summary.states_count} states`}
          />
          <StatCard
            icon={TrendingUp}
            label="High-Risk Projects"
            value={summary.high_risk_projects.toLocaleString()}
            sub=">30% cost overrun"
            color="text-red-400"
          />
          <StatCard
            icon={AlertTriangle}
            label="Anomalous Projects"
            value={summary.anomalous_projects.toLocaleString()}
            sub="Operational behavior outliers"
            color="text-amber-400"
          />
          <StatCard
            icon={AlertCircle}
            label="Cost Overrun Rate"
            value={summary.overrun_percentage != null ? `${summary.overrun_percentage}%` : 'Data unavailable'}
            sub={`${summary.overrun_count.toLocaleString()} projects exceeding budget`}
            color="text-amber-400"
          />
          <StatCard
            icon={Clock}
            label="Avg Schedule Delay"
            value={
              summary.avg_time_overrun_pct != null
                ? `+${summary.avg_time_overrun_pct}%`
                : summary.avg_time_overrun_months != null
                ? `+${summary.avg_time_overrun_months} Mo`
                : 'Data unavailable'
            }
            sub="Average time overrun"
            color="text-amber-300"
          />
          <StatCard
            icon={CheckCircle2}
            label="Avg Physical Progress"
            value={summary.avg_physical_progress != null ? `${summary.avg_physical_progress}%` : 'Data unavailable'}
            sub="Across active portfolio"
            color="text-emerald-400"
          />
        </div>
      )}

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Pie */}
        {riskDist && (
          <div className="card">
            <h2 className="font-semibold text-gray-200 mb-1">Portfolio Risk Classification</h2>
            <p className="text-xs text-gray-500 mb-4">Percentage breakdown of projects by cost overrun threshold</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskDist.distribution}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={(entry: any) => `${entry.percentage}%`}
                >
                  {riskDist.distribution.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={RISK_COLORS[entry.label] ?? '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                  }}
                  formatter={(val, name) => [`${val} projects`, name]}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Agencies Bar */}
        {topAgencies.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-200 mb-1">Top Implementing Agencies</h2>
            <p className="text-xs text-gray-500 mb-4">Project volume by nodal central ministry / PSU</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topAgencies} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  dataKey="agency"
                  type="category"
                  width={80}
                  stroke="#4b5563"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
                  formatter={(val) => [`${val} projects`, 'Total Projects']}
                />
                <Bar dataKey="project_count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* State-wise Breakdown */}
      {topStates.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-200 mb-1">State Infrastructure Analysis (Top 10 States)</h2>
          <p className="text-xs text-gray-500 mb-4">Concentration of central works, overrun percentages, and physical execution rates</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 text-left">
                  <th className="py-2.5 pr-4 font-medium">State / UT</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Projects</th>
                  <th className="py-2.5 px-4 font-medium text-right">Avg Cost Overrun %</th>
                  <th className="py-2.5 px-4 font-medium text-right">High-Risk Projects</th>
                  <th className="py-2.5 pl-4 font-medium text-right">Avg Physical Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {topStates.map((s) => {
                  const ovPct = s.avg_cost_overrun_pct ?? (s.avg_cost_overrun_ratio != null ? s.avg_cost_overrun_ratio * 100 : null)
                  return (
                    <tr key={s.state} className="hover:bg-gray-800/30">
                      <td className="py-2.5 pr-4 text-gray-200 font-medium">{s.state}</td>
                      <td className="py-2.5 px-4 text-right text-gray-300">{s.project_count}</td>
                      <td className="py-2.5 px-4 text-right">
                        {ovPct !== null ? (
                          <span className={
                            ovPct > 30 ? 'text-red-400 font-semibold' :
                            ovPct > 10 ? 'text-amber-400 font-semibold' :
                            'text-emerald-400 font-semibold'
                          }>
                            {ovPct > 0 ? `+${ovPct.toFixed(1)}%` : `${ovPct.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Data unavailable</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className={s.high_risk_count > 0 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                          {s.high_risk_count}
                        </span>
                      </td>
                      <td className="py-2.5 pl-4 text-right text-gray-200 font-medium">
                        {s.avg_physical_progress !== null ? `${s.avg_physical_progress.toFixed(1)}%` : 'Data unavailable'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
