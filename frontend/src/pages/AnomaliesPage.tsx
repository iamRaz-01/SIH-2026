import { useEffect, useState } from 'react'
import { getAnomalies, type Anomaly, type AnomaliesResponse } from '../api/client'
import { AlertTriangle, Zap } from 'lucide-react'

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomaliesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAnomalies({ limit: 100, only_flagged: onlyFlagged })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [onlyFlagged])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-400" />
            Intelligent Anomaly Detection
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            USP #1 — Isolation Forest on expenditure, progress, and cost-revision patterns
          </p>
          {data?.detector_status && (
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>Detector: {data.detector_status.fitted ? '✓ Active' : '✗ Not fitted'}</span>
              <span>Total projects scored: {data.detector_status.total_projects.toLocaleString()}</span>
              <span>Flagged anomalies: <span className="text-amber-400 font-bold">{data.detector_status.flagged_count}</span></span>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            className="rounded"
            checked={onlyFlagged}
            onChange={e => setOnlyFlagged(e.target.checked)}
          />
          Show only flagged
        </label>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Project</th>
                <th className="text-left px-4 py-3 font-medium">Agency</th>
                <th className="text-left px-4 py-3 font-medium">State</th>
                <th className="text-right px-4 py-3 font-medium">Anomaly Score</th>
                <th className="text-center px-4 py-3 font-medium">Flagged</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                      Analysing patterns…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data?.anomalies.map((a: Anomaly, i) => (
                <tr key={i} className={`border-b border-gray-800/40 hover:bg-gray-800/30 ${a.is_anomaly ? 'bg-amber-950/10' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-gray-200 line-clamp-2 max-w-xs">{a.project_name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{a.agency}</td>
                  <td className="px-4 py-3 text-gray-400">{a.state}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-800 rounded-full h-1.5">
                        <div
                          className="bg-amber-400 h-1.5 rounded-full"
                          style={{ width: `${Math.min(a.anomaly_score_norm * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-300 font-mono text-xs">
                        {(a.anomaly_score_norm * 100).toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {a.is_anomaly
                      ? <AlertTriangle className="h-4 w-4 text-amber-400 inline" />
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{a.anomaly_reason}</td>
                </tr>
              ))}
              {!loading && !data?.anomalies.length && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">No anomalies found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
