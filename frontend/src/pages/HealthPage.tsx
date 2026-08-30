import { useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '../api/client'
import { Activity, CheckCircle2, XCircle, RefreshCw, Database, Brain, AlertTriangle, Network } from 'lucide-react'

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#16A34A] mr-2 shrink-0 shadow-2xs" />
    : <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#DC2626] mr-2 shrink-0 shadow-2xs" />
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
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#16A34A]">Infrastructure Telemetry</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1 flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-[#2563EB]" />
            System Health &amp; Subsystems
          </h1>
          <p className="text-[#475569] text-[14px] font-normal mt-1">Real-time status of dataset pipelines, ML models, and network inference graphs</p>
        </div>
        <button onClick={load} className="btn-secondary text-[14px] font-medium py-2 px-3 flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Diagnostics
        </button>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-5 text-[#B91C1C] text-[14px] space-y-2">
          <p className="font-bold text-[16px]">Cannot reach analytics backend</p>
          <p className="text-[13px]">{error}</p>
          <p className="text-[#64748B] pt-1 text-[13px]">Make sure the FastAPI backend daemon is running on port 8000.</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Overall status banner */}
          <div className={`card p-5 flex items-center gap-4 ${
            data.status === 'healthy'
              ? 'border-[#BBF7D0] bg-[#F0FDF4]'
              : 'border-[#FDE68A] bg-[#FFFBEB]'
          }`}>
            {data.status === 'healthy'
              ? <CheckCircle2 className="h-9 w-9 text-[#16A34A] shrink-0" />
              : <XCircle className="h-9 w-9 text-[#D97706] shrink-0" />
            }
            <div>
              <p className={`font-bold text-[18px] ${data.status === 'healthy' ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
                {data.status === 'healthy' ? 'All Subsystems Operational' : 'Degraded — Component Error'}
              </p>
              <p className="text-[13px] text-[#475569] mt-0.5 font-normal">{data.app_name} v{data.app_version} · MoSPI Production Pipeline</p>
            </div>
          </div>

          {/* Dataset Subsystem */}
          <div className="card space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-[#2563EB]" />
                <h3 className="text-[20px] font-semibold text-[#0F172A]">PAIMANA Dataset Registry</h3>
              </div>
              <div className="flex items-center text-[13px]">
                <StatusDot ok={data.dataset?.loaded ?? false} />
                <span className="text-[#475569] font-medium">{data.dataset?.loaded ? 'Loaded' : 'Offline'}</span>
              </div>
            </div>
            {data.dataset?.loaded ? (
              <div className="text-[13px] text-[#475569] grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Total Records</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{(data.dataset.rows ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Features / Columns</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{data.dataset.columns?.length ?? 0}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Source File</span>
                  <p className="text-[#2563EB] font-medium text-[13px] mt-1.5 truncate">ongoing_project_25_26.xlsx</p>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-[#B91C1C]">Dataset failed to load: {data.dataset?.error}</p>
            )}
          </div>

          {/* ML Model Subsystem */}
          <div className="card space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4.5 w-4.5 text-[#7C3AED]" />
                <h3 className="text-[20px] font-semibold text-[#0F172A]">Supervised ML Engine (LightGBM)</h3>
              </div>
              <div className="flex items-center text-[13px]">
                <StatusDot ok={data.ml_model?.loaded ?? false} />
                <span className="text-[#475569] font-medium">{data.ml_model?.loaded ? 'Operational' : 'Offline'}</span>
              </div>
            </div>
            {data.ml_model?.loaded ? (
              <div className="text-[13px] text-[#475569] grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Model Class</span>
                  <p className="font-semibold text-[#0F172A] text-[15px] mt-0.5">{data.ml_model.type}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Decision Cutoff</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{data.ml_model.optimal_threshold?.toFixed(4)}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Training Instances</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{(data.ml_model.n_training_rows ?? 48894).toLocaleString()}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Validation ROC-AUC</span>
                  <p className="font-bold text-[#2563EB] text-[18px] mt-0.5">0.797</p>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-[#B91C1C]">Model unavailable: {data.ml_model?.error}</p>
            )}
          </div>

          {/* Anomaly Detector Subsystem */}
          <div className="card space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-[#D97706]" />
                <h3 className="text-[20px] font-semibold text-[#0F172A]">Unsupervised Anomaly Detector (Isolation Forest)</h3>
              </div>
              <div className="flex items-center text-[13px]">
                <StatusDot ok={data.anomaly_detector?.fitted ?? false} />
                <span className="text-[#475569] font-medium">{data.anomaly_detector?.fitted ? 'Fitted' : 'Offline'}</span>
              </div>
            </div>
            {data.anomaly_detector?.fitted ? (
              <div className="text-[13px] text-[#475569] grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Algorithm</span>
                  <p className="font-semibold text-[#0F172A] text-[14px] mt-0.5">Isolation Forest (9 Features)</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Total Scored</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{totalEvaluated.toLocaleString()}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Flagged Outliers</span>
                  <p className="font-bold text-[#B45309] text-[18px] mt-0.5">{flaggedAnomalies.toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-[#B91C1C]">Anomaly detector not fitted</p>
            )}
          </div>

          {/* Project Network Subsystem */}
          <div className="card space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <Network className="h-4.5 w-4.5 text-[#2563EB]" />
                <h3 className="text-[20px] font-semibold text-[#0F172A]">Project Knowledge Network</h3>
              </div>
              <div className="flex items-center text-[13px]">
                <StatusDot ok={data.project_network?.built ?? false} />
                <span className="text-[#475569] font-medium">{data.project_network?.built ? 'Constructed' : 'Offline'}</span>
              </div>
            </div>
            {data.project_network?.built ? (
              <div className="text-[13px] text-[#475569] grid grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Graph Nodes</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{(data.project_network.total_nodes ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold">Graph Edges</span>
                  <p className="font-bold text-[#0F172A] text-[18px] mt-0.5">{(data.project_network.total_edges ?? 0).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-[#B91C1C]">Project network not constructed</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
