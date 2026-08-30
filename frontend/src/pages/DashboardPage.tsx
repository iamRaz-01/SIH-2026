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
  Building2, TrendingUp, AlertCircle, CheckCircle2,
  IndianRupee, MapPin, Landmark, Activity,
} from 'lucide-react'

const RISK_COLORS: Record<string, string> = {
  'Low (0-10%)':      '#22c55e',
  'Medium (10-30%)':  '#f59e0b',
  'High (>30%)':      '#ef4444',
  'Under Budget':     '#3b82f6',
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
    <div className="card flex items-start gap-4">
      <div className="bg-gray-800 rounded-lg p-2.5 shrink-0">
        <Icon className="h-5 w-5 text-brand-400" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
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
    <div className="flex items-center justify-center h-full min-h-screen">
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Portfolio Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Central Sector Infrastructure Projects · PAIMANA/OCMS · ₹150 Cr+
        </p>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Building2}
            label="Total Projects"
            value={summary.total_projects.toLocaleString()}
            sub={`${summary.agencies_count} agencies · ${summary.states_count} states`}
          />
          <StatCard
            icon={AlertCircle}
            label="Cost Overrun Projects"
            value={summary.overrun_count.toLocaleString()}
            sub={`${summary.overrun_percentage}% of portfolio`}
            color="text-amber-400"
          />
          <StatCard
            icon={TrendingUp}
            label="High Risk Projects"
            value={summary.high_risk_projects.toLocaleString()}
            sub={`>30% cost overrun`}
            color="text-red-400"
          />
          <StatCard
            icon={IndianRupee}
            label="Total Revised Cost"
            value={summary.total_revised_cost_crore
              ? `₹${(summary.total_revised_cost_crore / 100000).toFixed(1)}L Cr`
              : 'N/A'
            }
            sub="Revised portfolio value"
          />
          <StatCard
            icon={CheckCircle2}
            label="Avg Physical Progress"
            value={summary.avg_physical_progress
              ? `${summary.avg_physical_progress.toFixed(1)}%`
              : 'N/A'
            }
            sub="Across active projects"
          />
          <StatCard
            icon={Activity}
            label="Avg Cost Overrun"
            value={summary.avg_cost_overrun_ratio !== null
              ? `${(summary.avg_cost_overrun_ratio * 100).toFixed(1)}%`
              : 'N/A'
            }
            sub="Mean across portfolio"
            color="text-amber-400"
          />
          <StatCard
            icon={MapPin}
            label="Medium Risk Projects"
            value={summary.medium_risk_projects.toLocaleString()}
            sub="10–30% cost overrun"
            color="text-amber-400"
          />
          <StatCard
            icon={Landmark}
            label="Low Risk Projects"
            value={summary.low_risk_projects.toLocaleString()}
            sub="<10% cost overrun"
            color="text-emerald-400"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Pie */}
        {riskDist && (
          <div className="card">
            <h2 className="font-semibold text-gray-200 mb-4">Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskDist.distribution}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
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
            <h2 className="font-semibold text-gray-200 mb-4">Top Agencies by Project Count</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topAgencies} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  dataKey="agency"
                  type="category"
                  width={70}
                  stroke="#4b5563"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
                />
                <Bar dataKey="project_count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* State Analysis Table */}
      {topStates.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-200 mb-4">State-wise Portfolio Analysis (Top 10)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium">State</th>
                  <th className="text-right py-2 px-4 font-medium">Projects</th>
                  <th className="text-right py-2 px-4 font-medium">Avg Overrun</th>
                  <th className="text-right py-2 px-4 font-medium">High Risk</th>
                  <th className="text-right py-2 pl-4 font-medium">Avg Progress</th>
                </tr>
              </thead>
              <tbody>
                {topStates.map((s) => (
                  <tr key={s.state} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 text-gray-200">{s.state}</td>
                    <td className="py-2 px-4 text-right text-gray-300">{s.project_count}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={
                        (s.avg_cost_overrun_ratio ?? 0) > 0.30 ? 'text-red-400' :
                        (s.avg_cost_overrun_ratio ?? 0) > 0.10 ? 'text-amber-400' : 'text-emerald-400'
                      }>
                        {s.avg_cost_overrun_ratio !== null
                          ? `${(s.avg_cost_overrun_ratio * 100).toFixed(1)}%`
                          : '—'
                        }
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-red-400">{s.high_risk_count}</td>
                    <td className="py-2 pl-4 text-right text-gray-300">
                      {s.avg_physical_progress !== null
                        ? `${s.avg_physical_progress.toFixed(1)}%`
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
