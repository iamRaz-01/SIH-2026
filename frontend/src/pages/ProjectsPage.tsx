import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects, type Project, type ProjectsResponse } from '../api/client'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

function RiskBadge({ ratio }: { ratio?: number | null }) {
  if (ratio === null || ratio === undefined) return <span className="badge-unknown">Unknown</span>
  if (ratio > 0.30) return <span className="badge-high">High</span>
  if (ratio > 0.10) return <span className="badge-medium">Medium</span>
  return <span className="badge-low">Low</span>
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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [debouncedSearch, filterRisk, filterState])

  useEffect(() => {
    setLoading(true)
    getProjects({
      page,
      page_size: 50,
      search: debouncedSearch || undefined,
      risk: filterRisk || undefined,
      state: filterState || undefined,
    })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, filterRisk, filterState])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Infrastructure Projects</h1>
        <p className="text-gray-500 text-sm mt-1">
          {data ? `${data.total.toLocaleString()} projects from PAIMANA dataset` : 'Loading…'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="input w-full pl-9"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value)}
        >
          <option value="">All Risk Levels</option>
          <option value="high">High (&gt;30%)</option>
          <option value="medium">Medium (10–30%)</option>
          <option value="low">Low (&lt;10%)</option>
        </select>
        <input
          className="input min-w-36"
          placeholder="Filter by state…"
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Project Name</th>
                <th className="text-left px-4 py-3 font-medium">Agency</th>
                <th className="text-left px-4 py-3 font-medium">State</th>
                <th className="text-right px-4 py-3 font-medium">Original Cost</th>
                <th className="text-right px-4 py-3 font-medium">Revised Cost</th>
                <th className="text-right px-4 py-3 font-medium">Progress</th>
                <th className="text-center px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                      Loading projects…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data?.projects.map((p: Project, i) => (
                <tr key={p.project_id ?? i} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-gray-200 font-medium line-clamp-2 max-w-xs">
                      {String(p.project_name ?? '—')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px]">
                    <span className="line-clamp-2">{String(p.agency ?? '—')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{String(p.state ?? '—')}</td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {p.original_cost != null ? `₹${Number(p.original_cost).toFixed(1)} Cr` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {p.revised_cost != null ? `₹${Number(p.revised_cost).toFixed(1)} Cr` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {p.physical_progress != null ? `${Number(p.physical_progress).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RiskBadge ratio={p.cost_overrun_ratio as number | null} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/projects/${p.project_id}`}
                      className="text-brand-400 hover:text-brand-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && !data?.projects.length && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">No projects found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Page {data.page} of {data.total_pages} ·{' '}
            {data.total.toLocaleString()} total
          </span>
          <div className="flex gap-2">
            <button
              className="btn-ghost py-1.5 px-3 flex items-center gap-1 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              className="btn-ghost py-1.5 px-3 flex items-center gap-1 disabled:opacity-40"
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
