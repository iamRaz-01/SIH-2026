import { useEffect, useState } from 'react'
import { getNetwork, type NetworkResponse } from '../api/client'
import { Network, Share2 } from 'lucide-react'

export default function NetworkPage() {
  const [data, setData] = useState<NetworkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNetwork(150)
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const riskColor = (rc: string) => {
    if (rc === 'High') return 'text-red-400 bg-red-950/30 border-red-800'
    if (rc === 'Medium') return 'text-amber-400 bg-amber-950/30 border-amber-800'
    return 'text-emerald-400 bg-emerald-950/30 border-emerald-800'
  }

  const hubIds = new Set(data?.stats?.hub_projects ?? [])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Share2 className="h-6 w-6 text-brand-400" />
          Project Network Intelligence
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          USP #2 — Co-dependency graph based on shared agency, state, and cost band
        </p>
        {data?.stats && (
          <div className="flex gap-5 mt-2 text-xs text-gray-500">
            <span>Nodes: <span className="text-gray-300">{data.stats.total_nodes}</span></span>
            <span>Edges: <span className="text-gray-300">{data.stats.total_edges}</span></span>
            <span>Avg degree: <span className="text-gray-300">{data.stats.avg_degree}</span></span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-10 w-10 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hub projects */}
          <div className="card">
            <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-brand-400" />
              Hub Projects (Highest Connectivity)
            </h2>
            <div className="space-y-2">
              {data.nodes
                .filter(n => hubIds.has(n.id))
                .sort((a, b) => b.degree - a.degree)
                .slice(0, 10)
                .map(n => (
                  <div
                    key={n.id}
                    className={`border rounded-lg px-3 py-2 text-sm ${riskColor(n.risk_class)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium line-clamp-1">{n.label}</span>
                      <span className="text-xs font-mono shrink-0 ml-2">deg: {n.degree}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-0.5">{n.agency} · {n.state}</p>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Edge relationships */}
          <div className="card lg:col-span-2">
            <h2 className="font-semibold text-gray-200 mb-3">Co-dependency Relationships (Sample)</h2>
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800 sticky top-0 bg-gray-900">
                  <tr className="text-gray-500">
                    <th className="text-left py-2 pr-4 font-medium">Project A</th>
                    <th className="text-left py-2 px-4 font-medium">Project B</th>
                    <th className="text-right py-2 px-4 font-medium">Weight</th>
                    <th className="text-left py-2 pl-4 font-medium">Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {data.edges.slice(0, 50).map((e, i) => {
                    const nodeA = data.nodes.find(n => n.id === e.source)
                    const nodeB = data.nodes.find(n => n.id === e.target)
                    return (
                      <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                        <td className="py-2 pr-4 text-gray-300 text-xs max-w-[160px]">
                          <span className="line-clamp-2">{nodeA?.label ?? e.source}</span>
                        </td>
                        <td className="py-2 px-4 text-gray-300 text-xs max-w-[160px]">
                          <span className="line-clamp-2">{nodeB?.label ?? e.target}</span>
                        </td>
                        <td className="py-2 px-4 text-right text-gray-400 font-mono text-xs">
                          {e.weight.toFixed(1)}
                        </td>
                        <td className="py-2 pl-4 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {e.reasons.map(r => (
                              <span key={r} className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-[10px]">
                                {r.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
