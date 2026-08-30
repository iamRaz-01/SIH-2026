import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects, getStateAnalysis, type Project, type ProjectsResponse } from '../api/client'
import { useWatchlist } from '../context/WatchlistContext'
import {
  Search, ChevronLeft, ChevronRight, ExternalLink, Star,
  LayoutGrid, List,
} from 'lucide-react'

function RiskBadge({ ratio }: { ratio?: number | null }) {
  if (ratio === null || ratio === undefined) return <span className="badge-unknown">Unknown</span>
  if (ratio > 0.30) return <span className="badge-danger">High Risk</span>
  if (ratio > 0.10) return <span className="badge-warning">Medium Risk</span>
  return <span className="badge-success">Low Risk</span>
}

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [filterState, setFilterState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [stateList, setStateList] = useState<string[]>([])

  const { isWatched, toggleWatch, watchedItems } = useWatchlist()

  // Load distinct states for dropdown
  useEffect(() => {
    getStateAnalysis()
      .then(res => {
        if (res.states && res.states.length > 0) {
          // Extract base state names and sort
          const states = res.states.map(s => s.state).filter(Boolean)
          setStateList(states)
        }
      })
      .catch(() => {
        // Fallback common states list if API unreachable
        setStateList([
          'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi',
          'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
          'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
          'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
          'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Multi-States'
        ])
      })
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [debouncedSearch, filterRisk, filterState, showWatchlistOnly])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getProjects({
      page,
      page_size: 40,
      search: debouncedSearch || undefined,
      risk: filterRisk || undefined,
      state: filterState.trim() || undefined,
    })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, filterRisk, filterState])

  const projectsToDisplay = (data?.projects || []).filter(p => {
    if (showWatchlistOnly) {
      return isWatched(p.project_id)
    }
    return true
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-[#F8FAFC]">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB]">Infrastructure Registry</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1">Central Sector Projects</h1>
          <p className="text-[#475569] text-[14px] font-normal mt-1">
            {data ? `${data.total.toLocaleString()} projects active in PAIMANA national database` : 'Loading portfolio registry…'}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#E2E8F0] p-1 rounded-xl shrink-0 shadow-2xs">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition ${
              viewMode === 'table' ? 'bg-[#0F172A] text-[#FFFFFF] shadow-xs' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <List className="h-4 w-4" />
            Table
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition ${
              viewMode === 'grid' ? 'bg-[#0F172A] text-[#FFFFFF] shadow-xs' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>
      </div>

      {/* ── Filters Toolbar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            className="input w-full pl-10 text-[15px] placeholder:text-[15px]"
            placeholder="Search project name, code, agency…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input text-[14px]"
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value)}
        >
          <option value="">All Risk Thresholds</option>
          <option value="high">High Risk (&gt;30% Overrun)</option>
          <option value="medium">Medium Risk (10–30%)</option>
          <option value="low">Low Risk (&lt;10%)</option>
        </select>

        {/* State Filter Dropdown (Supports all genuine dataset states + multi-state search) */}
        <select
          className="input text-[14px]"
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
        >
          <option value="">All States / UTs</option>
          {stateList.map(st => (
            <option key={st} value={st}>
              {st.length > 35 ? st.slice(0, 35) + '…' : st}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-end px-2">
          <button
            onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
            className={`text-[13px] px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition ${
              showWatchlistOnly
                ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309] font-semibold'
                : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] font-medium'
            }`}
          >
            <Star className={`h-4 w-4 ${showWatchlistOnly ? 'fill-[#F59E0B] text-[#F59E0B]' : ''}`} />
            Watchlist Only ({watchedItems.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 text-[#B91C1C] text-[14px]">
          {error}
        </div>
      )}

      {/* ── Table View ── */}
      {viewMode === 'table' && (
        <div className="card p-0 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <tr className="text-[#475569] text-left">
                  <th className="px-4 py-3.5 font-semibold w-10 text-center">★</th>
                  <th className="px-4 py-3.5 font-semibold">Project Name &amp; Code</th>
                  <th className="px-4 py-3.5 font-semibold">Agency</th>
                  <th className="px-4 py-3.5 font-semibold">State</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Sanctioned</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Revised</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Progress</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Risk Level</th>
                  <th className="px-4 py-3.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-[#64748B]">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-[#2563EB] border-t-transparent rounded-full" />
                        Querying project dataset…
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && projectsToDisplay.map((p: Project, i) => {
                  const watched = isWatched(p.project_id)
                  const cov = p.cost_overrun_ratio != null ? Number(p.cost_overrun_ratio) : null

                  return (
                    <tr key={p.project_id ?? i} className="hover:bg-[#F8FAFC] transition">
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleWatch({
                            project_id: p.project_id,
                            project_code: p.project_code,
                            project_name: p.project_name,
                            agency: p.agency,
                            state: p.state,
                            cost_overrun_pct: cov != null ? cov * 100 : null,
                          })}
                          className="text-[#94A3B8] hover:text-[#F59E0B] transition"
                          title={watched ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        >
                          <Star className={`h-4 w-4 ${watched ? 'text-[#F59E0B] fill-[#F59E0B]' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 max-w-sm">
                        <Link to={`/projects/${p.project_id}`} className="font-semibold text-[#0F172A] hover:text-[#2563EB] line-clamp-1 transition text-[14px]">
                          {p.project_name}
                        </Link>
                        <p className="text-[#64748B] text-[12px] font-normal mt-0.5">Code: {p.project_code || p.project_id}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[#475569] max-w-[160px] font-normal">
                        <span className="line-clamp-1">{p.agency}</span>
                      </td>
                      <td className="px-4 py-3.5 text-[#475569] font-normal">{p.state}</td>
                      <td className="px-4 py-3.5 text-right text-[#334155] font-normal">
                        {p.original_cost != null ? `₹${Number(p.original_cost).toFixed(1)} Cr` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#334155] font-normal">
                        {p.revised_cost != null ? `₹${Number(p.revised_cost).toFixed(1)} Cr` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-[#0F172A]">
                        {p.physical_progress != null ? `${Number(p.physical_progress).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <RiskBadge ratio={cov} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/projects/${p.project_id}`}
                          className="text-[#2563EB] hover:text-[#1D4ED8] p-1 inline-block"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}

                {!loading && !projectsToDisplay.length && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-[#64748B] text-[14px]">
                      No projects found matching your active filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cards View ── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!loading && projectsToDisplay.map((p, i) => {
            const watched = isWatched(p.project_id)
            const cov = p.cost_overrun_ratio != null ? Number(p.cost_overrun_ratio) : null

            return (
              <div key={p.project_id ?? i} className="card-interactive p-4.5 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <RiskBadge ratio={cov} />
                    <button
                      onClick={() => toggleWatch({
                        project_id: p.project_id,
                        project_code: p.project_code,
                        project_name: p.project_name,
                        agency: p.agency,
                        state: p.state,
                        cost_overrun_pct: cov != null ? cov * 100 : null,
                      })}
                      className="text-[#94A3B8] hover:text-[#F59E0B] p-1"
                    >
                      <Star className={`h-4 w-4 ${watched ? 'text-[#F59E0B] fill-[#F59E0B]' : ''}`} />
                    </button>
                  </div>

                  <h3 className="font-semibold text-[15px] text-[#0F172A] line-clamp-2 leading-snug">
                    <Link to={`/projects/${p.project_id}`} className="hover:text-[#2563EB]">
                      {p.project_name}
                    </Link>
                  </h3>
                  <p className="text-[12px] text-[#64748B] font-normal">Code: {p.project_code || p.project_id}</p>
                  <p className="text-[13px] text-[#475569] line-clamp-1 font-normal">{p.agency} · {p.state}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] text-center text-[13px]">
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Sanctioned</span>
                    <p className="font-semibold text-[#0F172A] mt-0.5">
                      {p.original_cost != null ? `₹${Number(p.original_cost).toFixed(0)}Cr` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Revised</span>
                    <p className="font-semibold text-[#0F172A] mt-0.5">
                      {p.revised_cost != null ? `₹${Number(p.revised_cost).toFixed(0)}Cr` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Progress</span>
                    <p className="font-semibold text-[#15803D] mt-0.5">
                      {p.physical_progress != null ? `${Number(p.physical_progress).toFixed(0)}%` : '—'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-end">
                  <Link
                    to={`/projects/${p.project_id}`}
                    className="text-[13px] text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1"
                  >
                    View Project <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {data && data.total_pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#475569] border-t border-[#E2E8F0] pt-4">
          <span>
            Showing Page <strong className="text-[#0F172A]">{data.page}</strong> of <strong className="text-[#0F172A]">{data.total_pages}</strong> ({data.total.toLocaleString()} total projects)
          </span>

          <div className="flex gap-2">
            <button
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-40 text-[13px]"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-40 text-[13px]"
              disabled={page >= data.total_pages}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
