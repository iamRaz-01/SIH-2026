import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProject,
  predictCostOverrun,
  explainPrediction,
  getProjectBenchmarks,
  getProjectAnomaly,
  type Project,
  type PredictionResult,
  type ShapExplanationResult,
  type ProjectBenchmarksResponse,
  type AnomalyDetail,
} from '../api/client'
import { useWatchlist } from '../context/WatchlistContext'
import {
  ArrowLeft, Brain, Sparkles, Zap, AlertTriangle,
  ShieldCheck, Star, Calendar,
} from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass?: string }) {
  const rc = String(riskClass || 'LOW').toUpperCase()
  if (rc === 'CRITICAL' || rc === 'HIGH') return <span className="badge-danger text-[13px] px-3.5 py-1">High Risk</span>
  if (rc === 'MEDIUM') return <span className="badge-warning text-[13px] px-3.5 py-1">Medium Risk</span>
  return <span className="badge-success text-[13px] px-3.5 py-1">Low Risk</span>
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [shapResult, setShapResult] = useState<ShapExplanationResult | null>(null)
  const [benchmarks, setBenchmarks] = useState<ProjectBenchmarksResponse | null>(null)
  const [anomaly, setAnomaly] = useState<AnomalyDetail | null>(null)

  const [loadingProject, setLoadingProject] = useState(true)
  const [loadingPred, setLoadingPred] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predError, setPredError] = useState<string | null>(null)

  const { isWatched, toggleWatch } = useWatchlist()

  useEffect(() => {
    if (!projectId) return
    setLoadingProject(true)
    setError(null)

    getProject(projectId)
      .then(p => {
        setProject(p)
        const code = p.project_code || p.project_id || projectId

        // Load benchmarks and anomaly details
        getProjectBenchmarks(String(code))
          .then(setBenchmarks)
          .catch(() => {})

        getProjectAnomaly(String(code))
          .then(setAnomaly)
          .catch(() => {})
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoadingProject(false))
  }, [projectId])

  const runPrediction = () => {
    if (!projectId) return
    setLoadingPred(true)
    setPredError(null)

    const code = project?.project_code || projectId
    predictCostOverrun({ project_code: String(code) })
      .then(res => {
        setPrediction(res)
        explainPrediction({ project_code: String(code) }, 5)
          .then(setShapResult)
          .catch(() => {})
      })
      .catch(e => setPredError(String(e)))
      .finally(() => setLoadingPred(false))
  }

  if (loadingProject) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="flex flex-col items-center gap-3 text-[#64748B]">
        <div className="animate-spin h-8 w-8 border-3 border-[#2563EB] border-t-transparent rounded-full" />
        <span className="text-[13px] font-medium tracking-wider uppercase">Loading Project Intelligence…</span>
      </div>
    </div>
  )

  if (error || !project) return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <Link to="/projects" className="text-[#2563EB] flex items-center gap-1.5 text-[14px] font-medium hover:text-[#1D4ED8]">
        <ArrowLeft className="h-4 w-4" /> Back to Project Registry
      </Link>
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-6 text-[#B91C1C]">
        <p className="font-bold text-[18px]">Project Not Found</p>
        <p className="text-[13px] mt-1">{error ?? 'Unable to resolve project record.'}</p>
      </div>
    </div>
  )

  const pId = project.project_id || projectId || ''
  const watched = isWatched(pId)
  const overrunRatio = project.cost_overrun_ratio as number | null
  const overrunPct = overrunRatio !== null && overrunRatio !== undefined ? (overrunRatio * 100).toFixed(1) : null

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-[#F8FAFC]">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/projects" className="text-[14px] text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1.5 transition">
          <ArrowLeft className="h-4 w-4" /> Back to All Projects
        </Link>
        <button
          onClick={() => toggleWatch({
            project_id: pId,
            project_code: project.project_code,
            project_name: project.project_name,
            agency: project.agency,
            state: project.state,
            cost_overrun_pct: overrunRatio != null ? overrunRatio * 100 : null,
          })}
          className={`btn-secondary text-[13px] py-1.5 px-3 flex items-center gap-1.5 ${
            watched ? 'border-[#FDE68A] text-[#B45309] bg-[#FFFBEB]' : ''
          }`}
        >
          <Star className={`h-4 w-4 ${watched ? 'fill-[#F59E0B] text-[#F59E0B]' : ''}`} />
          {watched ? 'Pinned in Watchlist' : 'Pin to Watchlist'}
        </button>
      </div>

      {/* ── Project Master Header Card ── */}
      <div className="card space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E2E8F0] text-[#2563EB]">
                Code: {String(project.project_code ?? project.project_id)}
              </span>
              {anomaly?.is_anomaly ? (
                <span className="badge-warning text-[13px] font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> Anomaly Flagged
                </span>
              ) : (
                <span className="badge-success text-[13px] font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" /> Standard Pattern
                </span>
              )}
            </div>

            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
              {String(project.project_name)}
            </h1>

            <p className="text-[14px] text-[#475569] font-normal">
              Implementing Agency: <strong className="text-[#0F172A]">{String(project.agency)}</strong> · State: <strong className="text-[#0F172A]">{String(project.state)}</strong>
            </p>
          </div>

          {overrunRatio !== null && (
            <div className={`text-right shrink-0 p-4 rounded-2xl border ${
              overrunRatio > 0.30 ? 'text-[#B91C1C] border-[#FECACA] bg-[#FEF2F2]' :
              overrunRatio > 0.10 ? 'text-[#B45309] border-[#FDE68A] bg-[#FFFBEB]' :
              'text-[#15803D] border-[#BBF7D0] bg-[#F0FDF4]'
            }`}>
              <span className="text-[12px] uppercase tracking-wider font-semibold opacity-85">Cost Variance</span>
              <p className="text-[32px] font-bold mt-0.5 leading-none">
                {overrunRatio > 0 ? `+${overrunPct}%` : `${overrunPct}%`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Financial & Execution Telemetry Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Sanctioned Cost', value: project.original_cost != null ? `₹${Number(project.original_cost).toFixed(1)} Cr` : 'Data unavailable' },
          { label: 'Revised Cost', value: project.revised_cost != null ? `₹${Number(project.revised_cost).toFixed(1)} Cr` : 'Data unavailable' },
          { label: 'Cumulative Spend', value: project.cumulative_expenditure != null ? `₹${Number(project.cumulative_expenditure).toFixed(1)} Cr` : 'Data unavailable' },
          { label: 'Physical Progress', value: project.physical_progress != null ? `${Number(project.physical_progress).toFixed(1)}%` : 'Data unavailable' },
          { label: 'Expenditure Ratio', value: project.expenditure_ratio != null ? `${(Number(project.expenditure_ratio) * 100).toFixed(1)}%` : 'Data unavailable' },
          { label: 'Report Snapshot', value: project.edition ? String(project.edition).split('T')[0] : 'Data unavailable' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3.5">
            <p className="text-[13px] font-medium text-[#64748B] uppercase tracking-wider">{label}</p>
            <p className="text-[18px] font-bold text-[#0F172A] mt-1 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Schedule Milestones ── */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
          <Calendar className="h-4.5 w-4.5 text-[#2563EB]" />
          <h3 className="text-[20px] font-semibold text-[#0F172A]">Schedule Milestones</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
          <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
            <p className="text-[#64748B] text-[12px] uppercase font-semibold">Date of Approval (DOA)</p>
            <p className="text-[#0F172A] font-medium text-[14px] mt-1">{project.doa ? String(project.doa).split('T')[0] : 'Data unavailable'}</p>
          </div>
          <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
            <p className="text-[#64748B] text-[12px] uppercase font-semibold">Original Target Completion</p>
            <p className="text-[#0F172A] font-medium text-[14px] mt-1">{project.original_target_doa ? String(project.original_target_doa).split('T')[0] : 'Data unavailable'}</p>
          </div>
          <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
            <p className="text-[#64748B] text-[12px] uppercase font-semibold">Revised Target Completion</p>
            <p className="text-[#0F172A] font-medium text-[14px] mt-1">{project.revised_completion ? String(project.revised_completion).split('T')[0] : 'Data unavailable'}</p>
          </div>
        </div>
      </div>

      {/* ── Operational Anomaly Diagnostic ── */}
      {anomaly && anomaly.is_anomaly && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#B45309] text-[14px] font-semibold uppercase tracking-wider">
            <Zap className="h-4 w-4 text-[#D97706]" />
            Isolation Forest Anomaly Diagnostic ({anomaly.severity || 'HIGH'} Severity)
          </div>
          <p className="text-[14px] font-normal text-[#334155] leading-relaxed">
            {anomaly.explanation || anomaly.anomaly_reason}
          </p>
        </div>
      )}

      {/* ── Machine Learning & Tree SHAP Feature Attribution ── */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div>
            <span className="text-[13px] font-semibold uppercase tracking-wider text-[#7C3AED]">Supervised Machine Learning</span>
            <h3 className="text-[20px] font-semibold text-[#0F172A] mt-0.5">LightGBM Cost-Overrun Prediction</h3>
            <p className="text-[14px] font-normal text-[#475569] mt-0.5">Trained LightGBM model inference with exact Tree SHAP feature attributions</p>
          </div>

          <button
            onClick={runPrediction}
            disabled={loadingPred}
            className="btn-primary text-[14px] font-semibold py-2 px-4 shrink-0"
          >
            <Brain className="h-4 w-4" />
            {loadingPred ? 'Running Pipeline…' : 'Run Live ML Prediction'}
          </button>
        </div>

        {predError && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 text-[#B91C1C] text-[13px]">
            {predError}
          </div>
        )}

        {prediction && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-center gap-5 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
              <RiskBadge riskClass={prediction.risk_level || prediction.risk_class} />
              <div>
                <span className="text-[12px] text-[#64748B] uppercase font-semibold">Overrun Probability</span>
                <p className="text-[32px] font-bold text-[#0F172A] leading-none mt-0.5">
                  {prediction.cost_overrun_probability != null
                    ? `${(prediction.cost_overrun_probability * 100).toFixed(1)}%`
                    : 'Data unavailable'
                  }
                </p>
              </div>
              <div className="text-[13px] text-[#475569] border-l border-[#E2E8F0] pl-4 space-y-0.5">
                <p>Decision: <strong className="text-[#0F172A]">{prediction.prediction || 'NORMAL'}</strong></p>
                <p className="text-[12px] text-[#64748B]">
                  Threshold: {((prediction.optimal_threshold ?? 0.387) * 100).toFixed(1)}% · Confidence: {prediction.confidence}
                </p>
              </div>
            </div>

            {/* Tree SHAP Attributions */}
            {shapResult && shapResult.top_contributing_features && (
              <div className="space-y-2 pt-2">
                <p className="text-[14px] font-semibold text-[#7C3AED] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Top Model Drivers (Tree SHAP Contribution)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {shapResult.top_contributing_features.map((f, i) => (
                    <div key={i} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 text-[13px] flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-[#0F172A] text-[14px]">{f.label}</p>
                        <p className="text-[#475569] text-[13px] font-normal mt-0.5">{f.explanation}</p>
                      </div>
                      <span className={`text-[12px] font-bold px-2.5 py-1 rounded-md ml-3 shrink-0 ${
                        f.impact === 'INCREASES_RISK'
                          ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                          : 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                      }`}>
                        {f.shap_value > 0 ? `+${f.shap_value.toFixed(2)}` : f.shap_value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cohort Peer Benchmarking ── */}
      {benchmarks && (
        <div className="card space-y-4">
          <div className="border-b border-[#E2E8F0] pb-3">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB]">Comparative Analytics</span>
            <h3 className="text-[20px] font-semibold text-[#0F172A] mt-0.5">Dataset Peer Benchmarking ({benchmarks.scale_bucket})</h3>
            <p className="text-[14px] font-normal text-[#475569] mt-0.5">Actual cohort distribution comparisons across state, agency, scale, and national peer groups</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(benchmarks.benchmarks).map(([key, cohort]) => {
              const overrunStats = cohort.statistics?.cost_overrun_pct
              const spendStats = cohort.statistics?.expenditure_ratio
              const progStats = cohort.statistics?.physical_progress

              return (
                <div key={key} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                    <p className="font-semibold text-[15px] text-[#0F172A]">{cohort.name}</p>
                    <span className="text-[13px] text-[#64748B]">n = {cohort.cohort_size.toLocaleString()}</span>
                  </div>

                  <div className="space-y-2 text-[13px]">
                    {overrunStats && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#475569]">Avg Cost Overrun</span>
                        <div className="text-right">
                          <span className="font-semibold text-[#0F172A]">{overrunStats.average}%</span>
                          {overrunStats.project_percentile != null && (
                            <span className="text-[12px] text-[#64748B] ml-2">({overrunStats.project_percentile}th %ile)</span>
                          )}
                        </div>
                      </div>
                    )}
                    {spendStats && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#475569]">Avg Spend Ratio</span>
                        <div className="text-right">
                          <span className="font-semibold text-[#0F172A]">{((spendStats.average ?? 0) * 100).toFixed(1)}%</span>
                          {spendStats.project_percentile != null && (
                            <span className="text-[12px] text-[#64748B] ml-2">({spendStats.project_percentile}th %ile)</span>
                          )}
                        </div>
                      </div>
                    )}
                    {progStats && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#475569]">Avg Physical Progress</span>
                        <div className="text-right">
                          <span className="font-semibold text-[#0F172A]">{progStats.average}%</span>
                          {progStats.project_percentile != null && (
                            <span className="text-[12px] text-[#64748B] ml-2">({progStats.project_percentile}th %ile)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
