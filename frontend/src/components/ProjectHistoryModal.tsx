import { useEffect, useState, useMemo } from 'react'
import {
  getProjectHistory,
  type ProjectHistoryResponse,
} from '../api/client'
import {
  X,
  History,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpDown,
  Building2,
  MapPin,
  Flame,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

interface ProjectHistoryModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

export default function ProjectHistoryModal({
  projectId,
  isOpen,
  onClose,
}: ProjectHistoryModalProps) {
  const [data, setData] = useState<ProjectHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState<'charts' | 'table' | 'milestones'>('charts')

  useEffect(() => {
    if (!isOpen || !projectId) return
    setLoading(true)
    setError(null)

    getProjectHistory(projectId)
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [isOpen, projectId])

  // Sorted history records
  const sortedHistory = useMemo(() => {
    if (!data?.history) return []
    const copy = [...data.history]
    if (sortOrder === 'desc') {
      return copy.reverse()
    }
    return copy
  }, [data, sortOrder])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#CBD5E1] overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider block">
                Historical Progress &amp; Evolution Analysis
              </span>
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight line-clamp-1 mt-0.5">
                {data?.project_name || 'Loading Project History…'}
              </h2>
              <div className="flex items-center gap-3 text-[12px] text-[#64748B] mt-0.5">
                <span>Code: <strong className="text-[#0F172A]">{data?.project_code || projectId}</strong></span>
                {data?.agency && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {data.agency}
                  </span>
                )}
                {data?.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {data.state}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] flex items-center justify-center transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-[#E2E8F0] bg-[#FFFFFF] text-[13px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('charts')}
              className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'charts'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <TrendingUp className="h-4 w-4" /> Evolution Trends
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'table'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Layers className="h-4 w-4" /> Reporting Cycles ({data?.timeline_count || 0})
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'milestones'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" /> Key Milestones ({data?.milestones?.length || 0})
            </button>
          </div>

          {data && data.timeline_count > 1 && (
            <span className="text-[12px] text-[#64748B] hidden sm:inline-block">
              {data.summary.first_edition} → {data.summary.latest_edition}
            </span>
          )}
        </div>

        {/* ── Modal Body Content ── */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#F8FAFC]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#64748B] text-[14px]">
              <div className="animate-spin h-7 w-7 border-3 border-[#2563EB] border-t-transparent rounded-full" />
              Retrieving authentic historical cycles for project {projectId}…
            </div>
          )}

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-[#B91C1C] text-[14px]">
              {error}
            </div>
          )}

          {!loading && data && !data.has_history && (
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#64748B] flex items-center justify-center mx-auto">
                <History className="h-6 w-6" />
              </div>
              <h3 className="text-[17px] font-bold text-[#0F172A]">Historical Progression Unavailable</h3>
              <p className="text-[13px] text-[#475569] max-w-md mx-auto">
                The central monitoring registry currently records 1 snapshot for this project. Multi-period historical trajectory requires multiple monitoring editions.
              </p>
            </div>
          )}

          {!loading && data && data.has_history && (
            <>
              {/* ── 1. Evolution Summary KPI Grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Metric 1: Progress Gain */}
                <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] space-y-1 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase">Progress Growth</span>
                  <p className="text-[24px] font-bold text-[#15803D] leading-none">
                    {data.summary.progress_gain_pp >= 0 ? `+${data.summary.progress_gain_pp}` : data.summary.progress_gain_pp} pp
                  </p>
                  <p className="text-[12px] text-[#475569]">
                    {data.summary.initial_progress}% → {data.summary.latest_progress}%
                  </p>
                </div>

                {/* Metric 2: Cost Growth */}
                <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] space-y-1 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase">Cost Evolution</span>
                  <p className={`text-[24px] font-bold leading-none ${
                    data.summary.cost_growth_cr > 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}>
                    {data.summary.cost_growth_cr > 0 ? `+₹${data.summary.cost_growth_cr.toFixed(1)} Cr` : '₹0.0 Cr'}
                  </p>
                  <p className="text-[12px] text-[#475569]">
                    {data.summary.cost_growth_pct > 0 ? `+${data.summary.cost_growth_pct}% Overrun` : 'Sanctioned baseline'}
                  </p>
                </div>

                {/* Metric 3: Spend Increase */}
                <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] space-y-1 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase">Expenditure Surge</span>
                  <p className="text-[24px] font-bold text-[#2563EB] leading-none">
                    +₹{data.summary.expenditure_growth_cr.toFixed(1)} Cr
                  </p>
                  <p className="text-[12px] text-[#475569]">
                    ₹{data.summary.initial_expenditure.toFixed(1)} Cr → ₹{data.summary.latest_expenditure.toFixed(1)} Cr
                  </p>
                </div>

                {/* Metric 4: Progress Velocity */}
                <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] space-y-1 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase">Progress Velocity</span>
                  <p className="text-[24px] font-bold text-[#7C3AED] leading-none">
                    {data.summary.progress_velocity_monthly_pp.toFixed(2)} pp/mo
                  </p>
                  <p className="text-[12px] text-[#475569]">
                    Across {data.timeline_count} monthly cycles
                  </p>
                </div>
              </div>

              {/* ── TAB 1: VISUAL TREND CHARTS ── */}
              {activeTab === 'charts' && (
                <div className="space-y-6">
                  {/* Chart 1: Physical Progress Progression */}
                  <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                      <div>
                        <h4 className="font-bold text-[16px] text-[#0F172A] flex items-center gap-2">
                          <TrendingUp className="h-4.5 w-4.5 text-[#15803D]" />
                          Physical Progress Progression (0–100%)
                        </h4>
                        <p className="text-[13px] text-[#64748B] font-normal">
                          Actual reported physical execution percentage over consecutive monitoring editions.
                        </p>
                      </div>
                      <span className="badge-success text-[12px] font-semibold px-2.5 py-0.5">
                        Latest: {data.summary.latest_progress}%
                      </span>
                    </div>

                    <div className="h-64 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#15803D" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#15803D" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis
                            dataKey="edition_label"
                            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'Inter' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            unit="%"
                            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'Inter' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                          />
                          <Tooltip
                            formatter={(val: any) => [`${val}%`, 'Physical Progress']}
                            labelFormatter={(label) => `Reporting Edition: ${label}`}
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#CBD5E1',
                              borderRadius: '0.75rem',
                              fontSize: '13px',
                              color: '#0F172A',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="physical_progress"
                            stroke="#15803D"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#progGrad)"
                            activeDot={{ r: 6, fill: '#15803D', stroke: '#FFFFFF', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Cost & Cumulative Expenditure Evolution */}
                  <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                      <div>
                        <h4 className="font-bold text-[16px] text-[#0F172A] flex items-center gap-2">
                          <Flame className="h-4.5 w-4.5 text-[#2563EB]" />
                          Cost &amp; Cumulative Expenditure Evolution (₹ Crore)
                        </h4>
                        <p className="text-[13px] text-[#64748B] font-normal">
                          Sanctioned capital cost, revised approved cost, and cumulative financial expenditure to date.
                        </p>
                      </div>
                    </div>

                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.history} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis
                            dataKey="edition_label"
                            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'Inter' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                          />
                          <YAxis
                            tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                            tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'Inter' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString()} Cr`, name]}
                            labelFormatter={(label) => `Edition: ${label}`}
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#CBD5E1',
                              borderRadius: '0.75rem',
                              fontSize: '13px',
                              color: '#0F172A',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                          <Line
                            type="monotone"
                            name="Revised Cost"
                            dataKey="revised_cost"
                            stroke="#DC2626"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            name="Sanctioned Cost"
                            dataKey="original_cost"
                            stroke="#64748B"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            name="Cumulative Expenditure"
                            dataKey="cumulative_expenditure"
                            stroke="#2563EB"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 2: DETAILED REPORTING TABLE ── */}
              {activeTab === 'table' && (
                <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E2E8F0] space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                    <h4 className="font-bold text-[16px] text-[#0F172A]">Chronological Reporting Cycles</h4>
                    <button
                      onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                      className="text-[12px] font-semibold text-[#2563EB] flex items-center gap-1 bg-[#EFF6FF] px-2.5 py-1 rounded-lg hover:bg-[#DBEAFE] transition"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      Sort: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569]">
                        <tr>
                          <th className="px-3.5 py-2.5 font-semibold text-left">Edition</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Progress</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Sanctioned Cost</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Revised Cost</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Cumulative Spend</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Cost Overrun</th>
                          <th className="px-3.5 py-2.5 font-semibold text-center">Target Completion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDF2F7]">
                        {sortedHistory.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-[#F8FAFC] transition">
                            <td className="px-3.5 py-2.5 font-semibold text-[#0F172A]">
                              {rec.edition_label || rec.edition_date || rec.edition}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-[#15803D]">
                              {rec.physical_progress != null ? `${rec.physical_progress}%` : '—'}
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-[#475569]">
                              ₹{Number(rec.original_cost || 0).toLocaleString()} Cr
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-[#0F172A]">
                              ₹{Number(rec.revised_cost || rec.original_cost || 0).toLocaleString()} Cr
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-[#2563EB]">
                              ₹{Number(rec.cumulative_expenditure || 0).toLocaleString()} Cr
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-[#DC2626]">
                              {rec.cost_overrun_pct != null ? `${rec.cost_overrun_pct.toFixed(1)}%` : '0.0%'}
                            </td>
                            <td className="px-3.5 py-2.5 text-center text-[#64748B]">
                              {rec.original_target_doa ? String(rec.original_target_doa).split('T')[0] : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── TAB 3: KEY MILESTONES & EVENTS ── */}
              {activeTab === 'milestones' && (
                <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E2E8F0] space-y-4 shadow-xs">
                  <h4 className="font-bold text-[16px] text-[#0F172A]">Detected Parameter Milestones &amp; Events</h4>
                  {data.milestones && data.milestones.length > 0 ? (
                    <div className="space-y-3">
                      {data.milestones.map((m, idx) => (
                        <div key={idx} className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] flex items-start gap-3 text-[13px]">
                          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#0F172A]">{m.title}</span>
                              <span className="text-[11px] font-semibold text-[#64748B] bg-[#FFFFFF] px-2 py-0.5 rounded border border-[#E2E8F0]">
                                {m.date}
                              </span>
                            </div>
                            <p className="text-[#475569] text-[13px] mt-0.5">{m.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#64748B] text-[13px] p-6 bg-[#F8FAFC] rounded-xl text-center">
                      No sudden cost revisions or progress surges detected across the reporting timeline. Execution parameters have remained steady.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#FFFFFF] flex items-center justify-between text-[12px] text-[#64748B]">
          <span>Source: Central Infrastructure Monitoring Registry (MoSPI)</span>
          <button
            onClick={onClose}
            className="btn-secondary text-[13px] py-1.5 px-4 font-semibold"
          >
            Close History Analysis
          </button>
        </div>
      </div>
    </div>
  )
}
