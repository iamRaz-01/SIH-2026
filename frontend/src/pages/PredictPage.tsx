import { useState } from 'react'
import { predictCostOverrun, type PredictionResult } from '../api/client'
import { Brain, Send } from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass: string }) {
  const cls =
    riskClass === 'High' ? 'badge-high text-lg px-4 py-1.5' :
    riskClass === 'Medium' ? 'badge-medium text-lg px-4 py-1.5' :
    riskClass === 'Low' ? 'badge-low text-lg px-4 py-1.5' :
    'badge-unknown text-lg px-4 py-1.5'
  return <span className={cls}>{riskClass} Risk</span>
}

export default function PredictPage() {
  const [form, setForm] = useState({
    project_name: '',
    agency: '',
    state: '',
    doa: '',
    original_target_doa: '',
    original_cost: '',
    cumulative_expenditure: '',
    physical_progress: '',
    edition: '',
  })
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    predictCostOverrun({
      project_name: form.project_name || undefined,
      agency: form.agency || undefined,
      state: form.state || undefined,
      doa: form.doa || undefined,
      original_target_doa: form.original_target_doa || undefined,
      original_cost: form.original_cost ? Number(form.original_cost) : undefined,
      cumulative_expenditure: form.cumulative_expenditure ? Number(form.cumulative_expenditure) : undefined,
      physical_progress: form.physical_progress ? Number(form.physical_progress) : undefined,
      edition: form.edition || undefined,
    })
      .then(setResult)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Brain className="h-6 w-6 text-brand-400" />
          Cost Overrun Risk Predictor
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter project details to run the trained LightGBM model (ROC-AUC: 0.797 · n=48,894 rows)
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Project Name</label>
            <input name="project_name" className="input w-full" value={form.project_name} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Agency</label>
            <input name="agency" className="input w-full" value={form.agency} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">State</label>
            <input name="state" className="input w-full" value={form.state} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Edition Date (YYYY-MM-DD)</label>
            <input name="edition" type="date" className="input w-full" value={form.edition} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date of Approval</label>
            <input name="doa" type="date" className="input w-full" value={form.doa} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Original Target Completion</label>
            <input name="original_target_doa" type="date" className="input w-full" value={form.original_target_doa} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Original Cost (₹ Crore) *</label>
            <input name="original_cost" type="number" step="0.01" className="input w-full" required value={form.original_cost} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Cumulative Expenditure (₹ Crore) *</label>
            <input name="cumulative_expenditure" type="number" step="0.01" className="input w-full" required value={form.cumulative_expenditure} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Physical Progress (0–100) *</label>
            <input name="physical_progress" type="number" step="0.1" min="0" max="100" className="input w-full" required value={form.physical_progress} onChange={onChange} />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          <Send className="h-4 w-4" />
          {loading ? 'Running model…' : 'Predict Cost Overrun Risk'}
        </button>
      </form>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {result && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-200">Prediction Result</h2>

          <div className="flex items-center gap-4">
            <RiskBadge riskClass={result.risk_class} />
            <div>
              <p className="text-3xl font-bold text-gray-100">
                {result.probability !== null ? `${(result.probability * 100).toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                Overrun probability · Threshold: {(result.optimal_threshold * 100).toFixed(1)}% ·
                Confidence: {result.confidence} · Status: {result.status}
              </p>
            </div>
          </div>

          {result.model_metrics && (
            <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 grid grid-cols-3 gap-4">
              <div><p className="text-gray-600">Model</p><p className="text-gray-200">{result.model_type}</p></div>
              {result.model_metrics.roc_auc && (
                <div><p className="text-gray-600">ROC-AUC</p><p className="text-gray-200">{result.model_metrics.roc_auc.toFixed(3)}</p></div>
              )}
              {result.model_metrics.pr_auc && (
                <div><p className="text-gray-600">PR-AUC</p><p className="text-gray-200">{result.model_metrics.pr_auc.toFixed(3)}</p></div>
              )}
            </div>
          )}

          {result.top_features.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Input Factors</p>
              <div className="space-y-1.5">
                {result.top_features.map(f => (
                  <div key={f.feature} className="flex items-center justify-between bg-gray-800/40 rounded px-3 py-2 text-sm">
                    <span className="text-gray-300">{f.label}</span>
                    <span className="text-gray-400 font-mono text-xs">
                      {f.numeric_value !== null
                        ? typeof f.value === 'number' ? f.value.toLocaleString() : String(f.value)
                        : String(f.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.missing_fields && result.missing_fields.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800 rounded-lg p-3 text-amber-400 text-xs">
              Insufficient data: {result.missing_fields.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
