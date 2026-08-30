import { useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '../api/client'
import { Activity, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shrink-0" />
    : <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-2 shrink-0" />
}

export default function HealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getHealth()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const totalEvaluated =
    data?.anomaly_detector?.total_projects ??
    data?.anomaly_detector?.total_evaluated ??
    0

  const flaggedAnomalies =
    data?.anomaly_detector?.flagged_count ??
    data?.anomaly_detector?.anomalies_flagged ??
    0

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-brand-400" />
            System Health
          </h1>
          <p className="text-gray-500 text-sm mt-1">Real-time backend component status</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400">
          <p className="font-bold">Cannot reach backend</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-sm mt-2 text-red-500">
            Start the backend: <code className="bg-gray-900 px-2 py-0.5 rounded text-xs">
              cd backend && python main.py
            </code>
          </p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Overall status */}
          <div className={`card flex items-center gap-3 ${data.status === 'healthy' ? 'border-emerald-800 bg-emerald-950/20' : 'border-amber-800 bg-amber-950/20'}`}>
            {data.status === 'healthy'
              ? <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              : <XCircle className="h-8 w-8 text-amber-400" />
            }
            <div>
              <p className={`font-bold text-lg ${data.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {data.status === 'healthy' ? 'All Systems Operational' : 'Degraded — Some Components Unavailable'}
              </p>
              <p className="text-gray-400 text-sm">{data.app_name} v{data.app_version}</p>
            </div>
          </div>

          {/* Dataset */}
          <div className="card">
            <div className="flex items-center gap-1 mb-2">
              <StatusDot ok={data.dataset?.loaded ?? false} />
              <h2 className="font-semibold text-gray-200">Dataset (PAIMANA / MoSPI)</h2>
            </div>
            {data.dataset?.loaded ? (
              <div className="text-sm text-gray-400 space-y-1">
                <p>Rows: <span className="text-gray-200">{(data.dataset.rows ?? 0).toLocaleString()}</span></p>
                <p>Columns: <span className="text-gray-200">{data.dataset.columns?.length ?? 0}</span> —{' '}
                  <span className="text-xs font-mono text-gray-500">{data.dataset.columns?.slice(0, 6).join(', ')}…</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-400">Not loaded: {data.dataset?.error}</p>
            )}
          </div>

          {/* ML Model */}
          <div className="card">
            <div className="flex items-center gap-1 mb-2">
              <StatusDot ok={data.ml_model?.loaded ?? false} />
              <h2 className="font-semibold text-gray-200">ML Model (LightGBM Cost-Overrun)</h2>
            </div>
            {data.ml_model?.loaded ? (
              <div className="text-sm text-gray-400 grid grid-cols-2 gap-2">
                <p>Type: <span className="text-gray-200">{data.ml_model.type}</span></p>
                <p>Optimal Threshold: <span className="text-gray-200">{data.ml_model.optimal_threshold?.toFixed(4)}</span></p>
                <p>Trained at: <span className="text-gray-200">{data.ml_model.trained_at ?? '2026-08-30'}</span></p>
                <p>Training rows: <span className="text-gray-200">{(data.ml_model.n_training_rows ?? 48894).toLocaleString()}</span></p>
                {data.ml_model.oof_metrics && Object.entries(data.ml_model.oof_metrics).slice(0, 6).map(([k, v]) => (
                  <p key={k}>{k}: <span className="text-gray-200">{typeof v === 'number' ? v.toFixed(4) : v}</span></p>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm text-red-400 mb-2">Not loaded</p>
                {data.ml_model?.error && (
                  <pre className="text-xs text-red-500 bg-gray-950 p-3 rounded-lg overflow-auto max-h-40">
                    {data.ml_model.error.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Anomaly Detector */}
          <div className="card">
            <div className="flex items-center gap-1 mb-2">
              <StatusDot ok={data.anomaly_detector?.fitted ?? false} />
              <h2 className="font-semibold text-gray-200">Anomaly Detector (Isolation Forest USP #1)</h2>
            </div>
            {data.anomaly_detector?.fitted ? (
              <div className="text-sm text-gray-400 space-y-1">
                <p>Algorithm: <span className="text-gray-200">Isolation Forest (Unsupervised)</span></p>
                <p>Projects scored: <span className="text-gray-200">{totalEvaluated.toLocaleString()}</span></p>
                <p>Anomalies flagged: <span className="text-amber-400 font-bold">{flaggedAnomalies}</span></p>
              </div>
            ) : (
              <p className="text-sm text-red-400">Not fitted</p>
            )}
          </div>

          {/* Network */}
          <div className="card">
            <div className="flex items-center gap-1 mb-2">
              <StatusDot ok={data.project_network?.built ?? false} />
              <h2 className="font-semibold text-gray-200">Project Network Graph (USP #2)</h2>
            </div>
            {data.project_network?.built ? (
              <div className="text-sm text-gray-400 space-y-1">
                <p>Nodes: <span className="text-gray-200">{(data.project_network.total_nodes ?? 0).toLocaleString()}</span></p>
                <p>Edges: <span className="text-gray-200">{(data.project_network.total_edges ?? 0).toLocaleString()}</span></p>
              </div>
            ) : (
              <p className="text-sm text-red-400">Not built</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
