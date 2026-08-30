import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getPortfolioRiskIntelligence,
  type PortfolioRiskIntelligenceResponse,
  type RiskScatterPoint,
} from '../api/client'
import {
  ShieldAlert,
  AlertOctagon,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  Sliders,
  BarChart3,
  Layers,
} from 'lucide-react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
} from 'recharts'

export default function RiskIntelligencePage() {
  const [data, setData] = useState<PortfolioRiskIntelligenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All')

  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getPortfolioRiskIntelligence()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // Filter scatter plot points
  const filteredScatterPoints = useMemo(() => {
    if (!data) return []
    if (selectedRiskFilter === 'All') return data.scatter_points
    return data.scatter_points.filter(p => p.risk_class.toUpperCase() === selectedRiskFilter.toUpperCase())
  }, [data, selectedRiskFilter])

  // Custom Tooltip for Project Value vs Risk Scatter Plot
  const ScatterCustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: RiskScatterPoint }> }) => {
    if (active && payload && payload.length) {
      const pt = payload[0].payload
      const isHigh = pt.risk_class === 'High'
      const isMedium = pt.risk_class === 'Medium'

      return (
        <div className="bg-[#FFFFFF] border border-[#CBD5E1] p-4 rounded-xl shadow-xl text-[13px] text-[#0F172A] max-w-sm space-y-2 pointer-events-none">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDF2F7] pb-1.5">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isHigh ? 'badge-danger' : isMedium ? 'badge-warning' : 'badge-success'
            }`}>
              {pt.risk_class} Risk ({pt.risk_pct}%)
            </span>
            {pt.is_anomaly && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full badge-purple">
                Anomaly
              </span>
            )}
          </div>

          <div>
            <p className="font-semibold text-[#0F172A] text-[14px] leading-snug line-clamp-2">{pt.project_name}</p>
            <p className="text-[#64748B] text-[12px] mt-0.5 font-normal">
              Code: <strong className="text-[#0F172A]">{pt.project_code}</strong> · {pt.agency}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[12px] bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
            <div>
              <span className="text-[#64748B] block">Project Value:</span>
              <strong className="text-[#0F172A] font-semibold">₹{pt.project_value?.toLocaleString()} Cr</strong>
            </div>
            <div>
              <span className="text-[#64748B] block">Cost Overrun:</span>
              <strong className={isHigh ? 'text-[#DC2626] font-semibold' : 'text-[#0F172A] font-semibold'}>
                {pt.cost_overrun_pct != null ? `${pt.cost_overrun_pct}%` : 'Data unavailable'}
              </strong>
            </div>
            <div>
              <span className="text-[#64748B] block">Time Overrun:</span>
              <strong className="text-[#0F172A] font-semibold">
                {pt.time_overrun_months != null ? `${pt.time_overrun_months} Mo` : 'On Schedule'}
              </strong>
            </div>
            <div>
              <span className="text-[#64748B] block">Physical Progress:</span>
              <strong className="text-[#15803D] font-semibold">
                {pt.physical_progress != null ? `${pt.physical_progress}%` : 'Data unavailable'}
              </strong>
            </div>
          </div>

          <p className="text-[11px] text-[#2563EB] font-medium pt-0.5 text-center flex items-center justify-center gap-1">
            Click to open project intelligence <ChevronRight className="h-3 w-3" />
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-[#F8FAFC]">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" />
            Portfolio Surveillance
          </span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1">
            Risk Intelligence
          </h1>
          <p className="text-[#475569] text-[14px] font-normal mt-1">
            Cost, schedule and risk analysis across the infrastructure portfolio.
          </p>
        </div>

        <Link
          to="/projects"
          className="btn-secondary text-[13px] font-semibold py-2 px-4 flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-2xs"
        >
          View All Projects <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 text-[#B91C1C] text-[14px]">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64 text-[#64748B] text-[14px] gap-2.5">
          <div className="animate-spin h-6 w-6 border-2 border-[#2563EB] border-t-transparent rounded-full" />
          Synthesizing portfolio risk intelligence…
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── 2. Top KPI Cards Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: High-Risk Projects */}
            <div className="card p-5 space-y-3 bg-[#FFFFFF] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wide">
                  High-Risk Projects
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-center justify-center">
                  <AlertOctagon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div>
                <p className="text-[32px] font-bold text-[#0F172A] leading-none tracking-tight">
                  {data.summary.high_risk_projects.toLocaleString()}
                </p>
                <p className="text-[13px] text-[#DC2626] font-medium mt-1.5">
                  {data.summary.high_risk_percentage}% of monitored portfolio
                </p>
              </div>
            </div>

            {/* Card 2: Predicted Cost Exposure */}
            <div className="card p-5 space-y-3 bg-[#FFFFFF] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wide">
                  Predicted Cost Exposure
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706] flex items-center justify-center">
                  <TrendingUp className="h-4.5 w-4.5" />
                </div>
              </div>
              <div>
                <p className="text-[32px] font-bold text-[#0F172A] leading-none tracking-tight">
                  ₹{data.summary.predicted_cost_exposure.toLocaleString()} Cr
                </p>
                <p className="text-[13px] text-[#475569] font-normal mt-1.5">
                  Cumulative variance on elevated risk works
                </p>
              </div>
            </div>

            {/* Card 3: Projects with Schedule Risk */}
            <div className="card p-5 space-y-3 bg-[#FFFFFF] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wide">
                  Schedule Risk
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center">
                  <Clock className="h-4.5 w-4.5" />
                </div>
              </div>
              <div>
                <p className="text-[32px] font-bold text-[#0F172A] leading-none tracking-tight">
                  {data.summary.schedule_risk_percentage}%
                </p>
                <p className="text-[13px] text-[#2563EB] font-medium mt-1.5">
                  Projects operating beyond approved timeline
                </p>
              </div>
            </div>

            {/* Card 4: Portfolio Risk Indicator */}
            <div className="card p-5 space-y-3 bg-[#FFFFFF] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wide">
                  Portfolio Overrun Index
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] flex items-center justify-center">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
              </div>
              <div>
                <p className="text-[32px] font-bold text-[#0F172A] leading-none tracking-tight">
                  {data.summary.portfolio_risk_indicator}%
                </p>
                <p className="text-[13px] text-[#475569] font-normal mt-1.5">
                  Mean cost overrun ratio across active projects
                </p>
              </div>
            </div>
          </div>

          {/* ── 3. Main Graph: Project Value vs Risk ── */}
          <div className="card p-6 space-y-4 bg-[#FFFFFF] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#0F172A] flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#2563EB]" />
                  Project Value vs Risk
                </h2>
                <p className="text-[14px] text-[#475569] font-normal mt-0.5">
                  High-value projects with elevated risk represent the highest potential financial exposure.
                </p>
              </div>

              {/* Threshold Filters */}
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] text-[12px] self-start sm:self-auto">
                {(['All', 'High', 'Medium', 'Low'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSelectedRiskFilter(tab)}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      selectedRiskFilter === tab
                        ? 'bg-[#0F172A] text-[#FFFFFF] shadow-2xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {tab === 'All' ? 'All Tiers' : `${tab} Risk`}
                  </button>
                ))}
              </div>
            </div>

            {/* Scatter Plot Visual */}
            <div className="h-96 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 30, bottom: 25, left: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      const pt = e.activePayload[0].payload as RiskScatterPoint
                      if (pt && pt.project_id) {
                        navigate(`/projects/${pt.project_id}`)
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    type="number"
                    dataKey="project_value"
                    name="Project Value"
                    unit=" Cr"
                    tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                    tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'Inter' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={{ stroke: '#CBD5E1' }}
                    label={{
                      value: 'Project Sanctioned / Revised Value (₹ Crore)',
                      position: 'insideBottom',
                      offset: -15,
                      fill: '#475569',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="risk_pct"
                    name="Risk"
                    unit="%"
                    domain={[0, 'auto']}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'Inter' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={{ stroke: '#CBD5E1' }}
                    label={{
                      value: 'Risk / Cost Overrun (%)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 0,
                      fill: '#475569',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  />
                  <Tooltip content={<ScatterCustomTooltip />} />
                  <Scatter
                    name="Projects"
                    data={filteredScatterPoints}
                    cursor="pointer"
                  >
                    {filteredScatterPoints.map((entry, index) => {
                      const color =
                        entry.risk_class === 'High' ? '#DC2626' :
                        entry.risk_class === 'Medium' ? '#F59E0B' :
                        '#16A34A'
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                          stroke={entry.is_anomaly ? '#7C3AED' : '#FFFFFF'}
                          strokeWidth={entry.is_anomaly ? 2 : 1}
                          opacity={0.85}
                        />
                      )
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#EDF2F7] text-[12px] text-[#475569]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#DC2626]" />
                  <span>High Risk (&gt;30% Overrun)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <span>Medium Risk (10–30%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
                  <span>Low Risk (&lt;10%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-[#7C3AED] bg-transparent" />
                  <span>Anomaly Outline</span>
                </div>
              </div>
              <span className="text-[#64748B] italic">Click any project node to view full intelligence breakdown</span>
            </div>
          </div>

          {/* ── 4. Grid Row: "What Drives Cost Overruns?" & "Sector Risk Comparison" ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* What Drives Cost Overruns? (LightGBM Global Feature Importances) */}
            <div className="card p-6 space-y-4 bg-[#FFFFFF] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-[#7C3AED]" />
                  <h3 className="text-[18px] font-semibold text-[#0F172A]">What Drives Cost Overruns?</h3>
                </div>
                <p className="text-[14px] text-[#475569] font-normal mt-0.5">
                  Key factors associated with elevated financial risk derived from trained LightGBM model gains.
                </p>

                <div className="mt-5 space-y-3.5">
                  {data.cost_drivers.map((driver, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#0F172A]">{driver.label}</span>
                        <span className="font-semibold text-[#7C3AED]">{driver.importance} / 100</span>
                      </div>
                      <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#7C3AED] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${driver.importance}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] text-[12px] text-[#64748B] flex items-center gap-2 mt-4">
                <Info className="h-4 w-4 text-[#2563EB] shrink-0" />
                <span>Computed via gain-based feature contributions from calibrated gradient boosted tree splits.</span>
              </div>
            </div>

            {/* Sector Risk Comparison (Bar Chart) */}
            <div className="card p-6 space-y-4 bg-[#FFFFFF] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-[#2563EB]" />
                    <h3 className="text-[18px] font-semibold text-[#0F172A]">Sector Risk Comparison</h3>
                  </div>
                  <span className="text-[12px] text-[#64748B] font-normal">Sorted: High → Low</span>
                </div>
                <p className="text-[14px] text-[#475569] font-normal mt-0.5">
                  Percentage of projects in each sector classified as high risk (&gt;30% cost overrun).
                </p>

                <div className="h-72 w-full pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.sector_risk.slice(0, 7)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        unit="%"
                        tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'Inter' }}
                        axisLine={{ stroke: '#CBD5E1' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="sector"
                        width={120}
                        tick={{ fill: '#0F172A', fontSize: 12, fontWeight: 500, fontFamily: 'Inter' }}
                        axisLine={{ stroke: '#CBD5E1' }}
                        tickFormatter={(s) => s.length > 16 ? s.slice(0, 16) + '…' : s}
                      />
                      <Tooltip
                        formatter={(val: any, _name: any, item: any) => [
                          `${val}% (${item?.payload?.high_risk_projects ?? 0} of ${item?.payload?.total_projects ?? 0} projects)`,
                          'Risk Ratio',
                        ]}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#CBD5E1',
                          borderRadius: '0.75rem',
                          fontSize: '13px',
                          color: '#0F172A',
                        }}
                      />
                      <Bar dataKey="risk_pct" radius={[0, 4, 4, 0]}>
                        {data.sector_risk.slice(0, 7).map((entry, index) => (
                          <Cell
                            key={`sector-${index}`}
                            fill={entry.risk_pct > 30 ? '#DC2626' : entry.risk_pct > 15 ? '#F59E0B' : '#2563EB'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] text-[12px] text-[#64748B] flex items-center gap-2 mt-4">
                <Info className="h-4 w-4 text-[#2563EB] shrink-0" />
                <span>Sector Risk % represents the proportion of works exceeding sanctioned budgets by over 30%.</span>
              </div>
            </div>
          </div>

          {/* ── 5. Intervention Priority Section (Top Ranked Projects) ── */}
          <div className="card p-6 space-y-4 bg-[#FFFFFF] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div>
                <h3 className="text-[20px] font-semibold text-[#0F172A]">Intervention Priority</h3>
                <p className="text-[14px] text-[#475569] font-normal mt-0.5">
                  Projects requiring attention based on risk, exposure and implementation impact.
                </p>
              </div>

              <Link
                to="/projects"
                className="text-[13px] text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-1"
              >
                View all projects in registry <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <tr className="text-[#475569] text-left">
                    <th className="px-4 py-3.5 font-semibold w-12 text-center">Rank</th>
                    <th className="px-4 py-3.5 font-semibold">Project Name &amp; Code</th>
                    <th className="px-4 py-3.5 font-semibold">State</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Project Value</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Cost Overrun</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Time Delay</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Progress</th>
                    <th className="px-4 py-3.5 font-semibold text-center">Anomaly</th>
                    <th className="px-4 py-3.5 font-semibold text-center">Priority</th>
                    <th className="px-4 py-3.5 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {data.intervention_priorities.map((item) => {
                    const isCrit = item.priority_level === 'CRITICAL'
                    const isHigh = item.priority_level === 'HIGH'

                    return (
                      <tr key={item.project_id} className="hover:bg-[#F8FAFC] transition">
                        <td className="px-4 py-3.5 text-center font-bold text-[#0F172A]">
                          #{item.rank}
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <Link
                            to={`/projects/${item.project_id}`}
                            className="font-semibold text-[#0F172A] hover:text-[#2563EB] line-clamp-1 transition text-[14px]"
                          >
                            {item.project_name}
                          </Link>
                          <p className="text-[#64748B] text-[12px] font-normal mt-0.5">
                            Code: {item.project_code} · {item.agency}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-[#475569] font-normal">{item.state}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-[#0F172A]">
                          ₹{item.project_value?.toLocaleString()} Cr
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-[#DC2626]">
                          {item.cost_overrun_pct != null ? `${item.cost_overrun_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-[#0F172A]">
                          {item.time_overrun_months != null ? `${item.time_overrun_months} Mo` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-[#15803D]">
                          {item.physical_progress != null ? `${item.physical_progress}%` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {item.is_anomaly ? (
                            <span className="badge-purple text-[11px] font-semibold px-2 py-0.5 rounded-full">
                              Flagged
                            </span>
                          ) : (
                            <span className="text-[#94A3B8] text-[12px]">Normal</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isCrit ? 'badge-danger' : isHigh ? 'badge-warning' : 'badge-primary'
                            }`}
                          >
                            {item.priority_level}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            to={`/projects/${item.project_id}`}
                            className="text-[#2563EB] hover:text-[#1D4ED8] p-1 inline-block"
                            title="Open Project Intelligence"
                          >
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
        </>
      )}
    </div>
  )
}
