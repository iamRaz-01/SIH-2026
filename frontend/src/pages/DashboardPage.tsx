import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'
import {
  Building2, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, AlertCircle, ExternalLink, ArrowUpRight,
} from 'lucide-react'

// Institutional Semantic Color Tokens for Charts
const RISK_COLORS: Record<string, string> = {
  'High Risk (>30%)':     '#DC2626',
  'Medium Risk (10-30%)': '#F59E0B',
  'Low Risk (0-10%)':     '#16A34A',
  'Under Budget (<0%)':   '#2563EB',
  'High (>30%)':          '#DC2626',
  'Medium (10-30%)':      '#F59E0B',
  'Low (0-10%)':          '#16A34A',
  'Under Budget':         '#2563EB',
}

function StatCard({
  icon: Icon, label, value, sub, iconBg = 'bg-[#EFF6FF]', iconColor = 'text-[#2563EB]', color = 'text-[#0F172A]'
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  iconBg?: string
  iconColor?: string
  color?: string
}) {
  return (
    <div className="card-interactive flex items-start gap-4 p-4.5">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        {/* KPI label: 17px | 400-500 */}
        <p className="text-[17px] font-medium text-[#475569] leading-tight tracking-wide">{label}</p>
        {/* KPI number: 30-32px | 700 */}
        <p className={`text-[32px] font-bold mt-1 tracking-tight leading-none ${color}`}>{value}</p>
        {/* KPI supporting text: 14px | 400 */}
        {sub && <p className="text-[14px] font-normal text-[#64748B] mt-1.5 truncate">{sub}</p>}
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
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="flex flex-col items-center gap-3 text-[#64748B]">
        <div className="animate-spin h-8 w-8 border-3 border-[#2563EB] border-t-transparent rounded-full" />
        <span className="text-[13px] font-medium tracking-wider uppercase">Loading Portfolio Telemetry…</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-6 text-[#B91C1C] space-y-2">
        <p className="font-bold text-[18px]">Failed to connect to analytics service</p>
        <p className="text-[13px] text-[#B91C1C]">{error}</p>
        <p className="text-[13px] text-[#64748B] pt-2">Please ensure the FastAPI backend is running on port 8000.</p>
      </div>
    </div>
  )

  const topStates = stateData?.states.slice(0, 10) ?? []
  const topAgencies = agencyData?.agencies.slice(0, 10) ?? []

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-[#F8FAFC]">
      {/* ── Main Dashboard Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB]">Portfolio Telemetry</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1">Infrastructure Overview</h1>
          <p className="text-[#475569] text-[14px] font-normal mt-1">
            Central Sector Monitoring &amp; Risk Intelligence · Ministry of Statistics &amp; Programme Implementation (MoSPI)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/projects" className="btn-secondary text-[14px] font-medium">
            Browse All Projects <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link to="/anomalies" className="btn-primary text-[14px] font-semibold">
            Review Anomalies <AlertTriangle className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── KPI Grid (White Cards with Soft Tinted Icon Containers) ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon={Building2}
            label={summary.latest_edition_label ? `Total Projects (${summary.latest_edition_label.replace(' Edition', '')})` : 'Total Projects'}
            value={(summary.latest_edition_projects ?? summary.total_projects).toLocaleString()}
            sub={`${(summary.latest_edition_agencies ?? summary.agencies_count)} agencies · ${(summary.latest_edition_states ?? summary.states_count)} states`}
            iconBg="bg-[#EFF6FF]"
            iconColor="text-[#2563EB]"
            color="text-[#0F172A]"
          />
          <StatCard
            icon={TrendingUp}
            label="High-Risk Projects"
            value={summary.high_risk_projects.toLocaleString()}
            sub=">30% cost overrun"
            iconBg="bg-[#FEF2F2]"
            iconColor="text-[#DC2626]"
            color="text-[#B91C1C]"
          />
          <StatCard
            icon={AlertTriangle}
            label="Anomalous Projects"
            value={summary.anomalous_projects.toLocaleString()}
            sub="Isolation Forest outliers"
            iconBg="bg-[#F5F3FF]"
            iconColor="text-[#7C3AED]"
            color="text-[#6D28D9]"
          />
          <StatCard
            icon={AlertCircle}
            label="Cost Overrun Rate"
            value={summary.overrun_percentage != null ? `${summary.overrun_percentage}%` : 'Data unavailable'}
            sub={`${summary.overrun_count.toLocaleString()} exceeding budget`}
            iconBg="bg-[#FFF7ED]"
            iconColor="text-[#F97316]"
            color="text-[#C2410C]"
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
            sub="Average timeline delay"
            iconBg="bg-[#FFFBEB]"
            iconColor="text-[#D97706]"
            color="text-[#B45309]"
          />
          <StatCard
            icon={CheckCircle2}
            label="Avg Physical Progress"
            value={summary.avg_physical_progress != null ? `${summary.avg_physical_progress}%` : 'Data unavailable'}
            sub="Across active portfolio"
            iconBg="bg-[#F0FDF4]"
            iconColor="text-[#16A34A]"
            color="text-[#15803D]"
          />
        </div>
      )}

      {/* ── Data Visualization Section (#FFFFFF cards with subtle borders) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Pie */}
        {riskDist && (
          <div className="card space-y-4">
            <div>
              <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB]">Risk Stratification</span>
              <h3 className="text-[20px] font-semibold text-[#0F172A] mt-0.5">Budget Variance Distribution</h3>
              <p className="text-[14px] font-normal text-[#475569] mt-0.5">Percentage breakdown of active infrastructure works by cost overrun band</p>
            </div>

            <div className="h-[300px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDist.distribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={105}
                    paddingAngle={3}
                    label={(entry: any) => `${entry.percentage}%`}
                  >
                    {riskDist.distribution.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={RISK_COLORS[entry.label] ?? '#94A3B8'}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      color: '#0F172A',
                      fontSize: '13px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    }}
                    formatter={(val, name) => [`${val} projects`, name]}
                  />
                  <Legend wrapperStyle={{ color: '#475569', fontSize: '13px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Implementing Agencies Bar Chart */}
        {topAgencies.length > 0 && (
          <div className="card space-y-4">
            <div>
              <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB]">Nodal PSUs &amp; Ministries</span>
              <h3 className="text-[20px] font-semibold text-[#0F172A] mt-0.5">Top Implementing Agencies</h3>
              <p className="text-[14px] font-normal text-[#475569] mt-0.5">Distribution of major infrastructure projects by nodal authority</p>
            </div>

            <div className="h-[300px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAgencies} layout="vertical" margin={{ left: 10, right: 25, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" horizontal={false} />
                  <XAxis type="number" stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 13 }} />
                  <YAxis
                    dataKey="agency"
                    type="category"
                    width={90}
                    stroke="#94A3B8"
                    tick={{ fill: '#475569', fontSize: 13 }}
                    tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      color: '#0F172A',
                      fontSize: '13px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    }}
                    formatter={(val) => [`${val} projects`, 'Project Count']}
                  />
                  <Bar dataKey="project_count" fill="#2563EB" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── State Infrastructure Breakdown Table ── */}
      {topStates.length > 0 && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
            <div>
              <span className="text-[13px] font-semibold uppercase tracking-wider text-[#16A34A]">Geographic Concentration</span>
              <h3 className="text-[20px] font-semibold text-[#0F172A] mt-0.5">State-Level Infrastructure Analysis (Top 10)</h3>
              <p className="text-[14px] font-normal text-[#475569] mt-0.5">Project density, average budget escalation percentage, and physical execution velocity</p>
            </div>
            <Link to="/projects" className="text-[14px] text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1">
              View All States <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[#475569] border-b border-[#E2E8F0] text-left bg-[#F8FAFC]">
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">State / UT</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Projects</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Avg Cost Overrun %</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">High-Risk Count</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Physical Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-sans">
                {topStates.map((s) => {
                  const ovPct = s.avg_cost_overrun_pct ?? (s.avg_cost_overrun_ratio != null ? s.avg_cost_overrun_ratio * 100 : null)
                  return (
                    <tr key={s.state} className="hover:bg-[#F8FAFC] transition">
                      <td className="py-3.5 px-4 text-[#0F172A] font-medium">{s.state}</td>
                      <td className="py-3.5 px-4 text-right text-[#475569] font-normal">{s.project_count}</td>
                      <td className="py-3.5 px-4 text-right font-medium">
                        {ovPct !== null ? (
                          <span className={
                            ovPct > 30 ? 'text-[#B91C1C] font-semibold' :
                            ovPct > 10 ? 'text-[#B45309] font-semibold' :
                            'text-[#15803D] font-semibold'
                          }>
                            {ovPct > 0 ? `+${ovPct.toFixed(1)}%` : `${ovPct.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] italic">Data unavailable</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[13px] font-medium ${
                          s.high_risk_count > 0 ? 'badge-critical' : 'text-[#94A3B8]'
                        }`}>
                          {s.high_risk_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-[#0F172A]">
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
