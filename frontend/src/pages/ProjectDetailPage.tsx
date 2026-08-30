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
import { ArrowLeft, Brain, Sparkles, Zap, BarChart3, AlertTriangle, ShieldCheck } from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass?: string }) {
  const rc = String(riskClass || 'LOW').toUpperCase()
  if (rc === 'CRITICAL' || rc === 'HIGH') return <span className="badge-high text-sm px-3 py-1">High Risk</span>
  if (rc === 'MEDIUM') return <span className="badge-medium text-sm px-3 py-1">Medium Risk</span>
  return <span className="badge-low text-sm px-3 py-1">Low Risk</span>
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

  useEffect(() => {
    if (!projectId) return
    setLoadingProject(true)

    getProject(projectId)
      .then(p => {
        setProject(p)
        const code = p.project_code || p.project_id || projectId

        // Parallel load benchmarks and anomaly details
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
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  )

  if (error || !project) return (
    <div className="p-8">
      <Link to="/projects" className="text-brand-400 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>
      <div className="bg-red-950/50 border border-red-800 rounded-xl p-6 text-red-400">
        {error ?? 'Project not found'}
      </div>
    </div>
  )

  const overrunRatio = project.cost_overrun_ratio as number | null
  const overrunPct = overrunRatio !== null && overrunRatio !== undefined ? (overrunRatio * 100).toFixed(1) : null

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/projects" className="text-brand-400 flex items-center gap-1 text-sm hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                Code: {String(project.project_code ?? project.project_id)}
              </span>
              {anomaly?.is_anomaly ? (
                <span className="text-[11px] font-bold bg-amber-950/80 border border-amber-700 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Anomaly Flagged
                </span>
              ) : (
                <span className="text-[11px] font-bold bg-emerald-950/50 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Standard Pattern
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-100">{String(project.project_name)}</h1>
            <p className="text-gray-400 mt-1">{String(project.agency)}</p>
            <p className="text-gray-500 text-sm">{String(project.state)}</p>
          </div>

          {overrunRatio !== null && (
            <div className={`text-right shrink-0 p-3 rounded-xl border ${
              overrunRatio > 0.30 ? 'text-red-400 border-red-900 bg-red-950/20' :
              overrunRatio > 0.10 ? 'text-amber-400 border-amber-900 bg-amber-950/20' :
              'text-emerald-400 border-emerald-900 bg-emerald-950/20'
            }`}>
              <p className="text-3xl font-bold">{overrunPct}%</p>
              <p className="text-xs opacity-70">Historical Cost Revision</p>
            </div>
          )}
        </div>
      </div>

      {/* Financial Details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Sanctioned Cost', value: project.original_cost != null ? `₹${Number(project.original_cost).toFixed(1)} Cr` : '—' },
          { label: 'Revised Cost', value: project.revised_cost != null ? `₹${Number(project.revised_cost).toFixed(1)} Cr` : '—' },
          { label: 'Cumulative Spend', value: project.cumulative_expenditure != null ? `₹${Number(project.cumulative_expenditure).toFixed(1)} Cr` : '—' },
          { label: 'Physical Progress', value: project.physical_progress != null ? `${Number(project.physical_progress).toFixed(1)}%` : '—' },
          { label: 'Expenditure Ratio', value: project.expenditure_ratio != null ? `${(Number(project.expenditure_ratio) * 100).toFixed(1)}%` : '—' },
          { label: 'Report Edition', value: project.edition ? String(project.edition).split('T')[0] : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card py-3 px-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-base font-semibold text-gray-200 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Anomaly Callout (if detected) */}
      {anomaly && anomaly.is_anomaly && (
        <div className="bg-amber-950/30 border border-amber-700/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
            <Zap className="h-4 w-4 text-amber-400" />
            Isolation Forest Anomaly Diagnostic ({anomaly.severity || 'HIGH'} Severity)
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{anomaly.explanation || anomaly.anomaly_reason}</p>
        </div>
      )}

      {/* ML Prediction & Tree SHAP */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-200 flex items-center gap-2">
            <Brain className="h-5 w-5 text-brand-400" />
            Trained LightGBM Prediction &amp; SHAP Explainability
          </h2>
          <button
            onClick={runPrediction}
            disabled={loadingPred}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4"
          >
            <Brain className="h-4 w-4" />
            {loadingPred ? 'Running LightGBM…' : 'Run Live ML Prediction'}
          </button>
        </div>

        {predError && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-400 text-xs">
            {predError}
          </div>
        )}

        {prediction && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-4 bg-gray-800/40 p-4 rounded-xl border border-gray-700/60">
              <RiskBadge riskClass={prediction.risk_level || prediction.risk_class} />
              <div>
                <p className="text-gray-400 text-xs uppercase font-medium">Predicted Probability</p>
                <p className="text-2xl font-bold text-gray-100">
                  {prediction.cost_overrun_probability != null
                    ? `${(prediction.cost_overrun_probability * 100).toFixed(1)}%`
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="text-xs text-gray-400 border-l border-gray-700 pl-4 space-y-0.5">
                <p>Decision: <strong className="text-gray-200">{prediction.prediction || 'NORMAL'}</strong></p>
                <p>Threshold: {((prediction.optimal_threshold ?? 0.387) * 100).toFixed(1)}% · Confidence: {prediction.confidence}</p>
              </div>
            </div>

            {/* Tree SHAP Explainability */}
            {shapResult && shapResult.top_contributing_features && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand-400" />
                  Top Model Drivers (Tree SHAP Attribution)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {shapResult.top_contributing_features.map((f, i) => (
                    <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-2.5 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-200">{f.label}</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">{f.explanation}</p>
                      </div>
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                        f.impact === 'INCREASES_RISK' ? 'bg-red-950 text-red-300' : 'bg-emerald-950 text-emerald-300'
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

      {/* Cohort Benchmarks */}
      {benchmarks && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-200 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-400" />
            Dataset Peer Benchmarking ({benchmarks.scale_bucket})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(benchmarks.benchmarks).map(([key, cohort]) => {
              const overrunStats = cohort.statistics?.cost_overrun_pct
              const spendStats = cohort.statistics?.expenditure_ratio
              const progStats = cohort.statistics?.physical_progress

              return (
                <div key={key} className="bg-gray-800/30 border border-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <p className="font-bold text-xs text-gray-200">{cohort.name}</p>
                    <span className="text-[11px] text-gray-500">n = {cohort.cohort_size.toLocaleString()}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {overrunStats && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Avg Cost Overrun</span>
                        <div className="text-right">
                          <span className="text-gray-200 font-semibold">{overrunStats.average}%</span>
                          {overrunStats.project_percentile != null && (
                            <span className="text-[10px] text-gray-500 ml-2">({overrunStats.project_percentile}th %ile)</span>
                          )}
                        </div>
                      </div>
                    )}
                    {spendStats && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Avg Expenditure Ratio</span>
                        <div className="text-right">
                          <span className="text-gray-200 font-semibold">{((spendStats.average ?? 0) * 100).toFixed(1)}%</span>
                          {spendStats.project_percentile != null && (
                            <span className="text-[10px] text-gray-500 ml-2">({spendStats.project_percentile}th %ile)</span>
                          )}
                        </div>
                      </div>
                    )}
                    {progStats && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Avg Physical Progress</span>
                        <div className="text-right">
                          <span className="text-gray-200 font-semibold">{progStats.average}%</span>
                          {progStats.project_percentile != null && (
                            <span className="text-[10px] text-gray-500 ml-2">({progStats.project_percentile}th %ile)</span>
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
