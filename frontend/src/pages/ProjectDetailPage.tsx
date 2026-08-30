import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProject, predictCostOverrun, type Project, type PredictionResult } from '../api/client'
import { ArrowLeft, Brain } from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass: string }) {
  if (riskClass === 'High') return <span className="badge-high text-base px-3 py-1">High Risk</span>
  if (riskClass === 'Medium') return <span className="badge-medium text-base px-3 py-1">Medium Risk</span>
  if (riskClass === 'Low') return <span className="badge-low text-base px-3 py-1">Low Risk</span>
  return <span className="badge-unknown text-base px-3 py-1">Unknown</span>
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [loadingPred, setLoadingPred] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predError, setPredError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setLoadingProject(true)
    getProject(projectId)
      .then(setProject)
      .catch(e => setError(String(e)))
      .finally(() => setLoadingProject(false))
  }, [projectId])

  const runPrediction = () => {
    if (!projectId) return
    setLoadingPred(true)
    setPredError(null)
    predictCostOverrun({ project_id: projectId })
      .then(setPrediction)
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
  const overrunPct = overrunRatio !== null ? (overrunRatio * 100).toFixed(1) : null

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link to="/projects" className="text-brand-400 flex items-center gap-1 text-sm hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-100">{String(project.project_name)}</h1>
            <p className="text-gray-400 mt-1">{String(project.agency)}</p>
            <p className="text-gray-500 text-sm">{String(project.state)} · Code: {String(project.project_code ?? '—')}</p>
          </div>
          {overrunRatio !== null && (
            <div className={`text-right shrink-0 ${overrunRatio > 0.30 ? 'text-red-400' : overrunRatio > 0.10 ? 'text-amber-400' : 'text-emerald-400'}`}>
              <p className="text-3xl font-bold">{overrunPct}%</p>
              <p className="text-xs">Cost Overrun</p>
            </div>
          )}
        </div>
      </div>

      {/* Financial Details */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Original Cost', value: project.original_cost != null ? `₹${Number(project.original_cost).toFixed(2)} Cr` : '—' },
          { label: 'Revised Cost', value: project.revised_cost != null ? `₹${Number(project.revised_cost).toFixed(2)} Cr` : '—' },
          { label: 'Expenditure', value: project.cumulative_expenditure != null ? `₹${Number(project.cumulative_expenditure).toFixed(2)} Cr` : '—' },
          { label: 'Physical Progress', value: project.physical_progress != null ? `${Number(project.physical_progress).toFixed(1)}%` : '—' },
          { label: 'Expenditure Ratio', value: project.expenditure_ratio != null ? `${(Number(project.expenditure_ratio) * 100).toFixed(1)}%` : '—' },
          { label: 'Edition', value: project.edition ? String(project.edition).split('T')[0] : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-lg font-semibold text-gray-200 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Date Details */}
      <div className="card">
        <h2 className="font-semibold text-gray-200 mb-3">Schedule Information</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Date of Approval</p>
            <p className="text-gray-200 mt-0.5">{project.doa ? String(project.doa).split('T')[0] : '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Original Target</p>
            <p className="text-gray-200 mt-0.5">{project.original_target_doa ? String(project.original_target_doa).split('T')[0] : '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Revised Completion</p>
            <p className="text-gray-200 mt-0.5">{project.revised_completion ? String(project.revised_completion).split('T')[0] : '—'}</p>
          </div>
        </div>
      </div>

      {/* ML Prediction */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-200">Cost Overrun Risk Prediction</h2>
          <button
            onClick={runPrediction}
            disabled={loadingPred}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Brain className="h-4 w-4" />
            {loadingPred ? 'Predicting…' : 'Run Prediction'}
          </button>
        </div>

        {predError && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
            {predError}
          </div>
        )}

        {prediction && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <RiskBadge riskClass={prediction.risk_class} />
              <div>
                <p className="text-gray-400 text-sm">
                  Probability: <span className="text-gray-100 font-bold text-lg">
                    {prediction.probability !== null ? `${(prediction.probability * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </p>
                <p className="text-gray-500 text-xs">
                  Threshold: {(prediction.optimal_threshold * 100).toFixed(1)}% ·
                  Confidence: {prediction.confidence} ·
                  Status: {prediction.status}
                </p>
              </div>
            </div>

            {prediction.model_metrics && (
              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 flex gap-4">
                <span>Model: {prediction.model_type}</span>
                {prediction.model_metrics.roc_auc && (
                  <span>ROC-AUC: {prediction.model_metrics.roc_auc.toFixed(3)}</span>
                )}
                {prediction.model_metrics.pr_auc && (
                  <span>PR-AUC: {prediction.model_metrics.pr_auc.toFixed(3)}</span>
                )}
              </div>
            )}

            {prediction.top_features.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Key Input Factors</p>
                <div className="space-y-1.5">
                  {prediction.top_features.map(f => (
                    <div key={f.feature} className="flex items-center justify-between bg-gray-800/40 rounded px-3 py-2 text-sm">
                      <span className="text-gray-300">{f.label}</span>
                      <span className="text-gray-400 font-mono">
                        {f.numeric_value !== null ? f.numeric_value.toLocaleString() : String(f.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prediction.missing_fields && prediction.missing_fields.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-800 rounded-lg p-3 text-amber-400 text-xs">
                Missing data: {prediction.missing_fields.join(', ')}
              </div>
            )}
          </div>
        )}

        {!prediction && !predError && (
          <p className="text-gray-500 text-sm">
            Click "Run Prediction" to score this project with the trained LightGBM model.
          </p>
        )}
      </div>
    </div>
  )
}
