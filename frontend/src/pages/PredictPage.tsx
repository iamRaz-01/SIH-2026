import { useState } from 'react'
import { predictCostOverrun, explainPrediction, type PredictionResult, type ShapExplanationResult } from '../api/client'
import { Brain, Send, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass?: string }) {
  const rc = String(riskClass || 'LOW').toUpperCase()
  const cls =
    rc === 'CRITICAL' || rc === 'HIGH' ? 'badge-high text-sm px-3.5 py-1' :
    rc === 'MEDIUM' ? 'badge-medium text-sm px-3.5 py-1' :
    'badge-low text-sm px-3.5 py-1'
  return <span className={cls}>{rc} Risk</span>
}

export default function PredictPage() {
  const [projectCodeInput, setProjectCodeInput] = useState('')
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
  const [shapResult, setShapResult] = useState<ShapExplanationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    setShapResult(null)

    const payload = projectCodeInput.trim()
      ? { project_code: projectCodeInput.trim() }
      : {
          project_name: form.project_name || undefined,
          agency: form.agency || undefined,
          state: form.state || undefined,
          doa: form.doa || undefined,
          original_target_doa: form.original_target_doa || undefined,
          original_cost: form.original_cost ? Number(form.original_cost) : undefined,
          cumulative_expenditure: form.cumulative_expenditure ? Number(form.cumulative_expenditure) : undefined,
          physical_progress: form.physical_progress ? Number(form.physical_progress) : undefined,
          edition: form.edition || undefined,
        }

    predictCostOverrun(payload)
      .then(res => {
        setResult(res)
        explainPrediction(payload, 6)
          .then(setShapResult)
          .catch(() => {})
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  const prob = result?.cost_overrun_probability ?? result?.probability
  const riskClass = result?.risk_level || result?.risk_class || 'LOW'

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Brain className="h-6 w-6 text-brand-400" />
          LightGBM Cost-Overrun &amp; SHAP Predictor
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Scored by the trained LightGBM ML model calibrated on 48,894 records (ROC-AUC: 0.797 · Threshold: 38.7%)
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5">
        {/* Quick project code lookup */}
        <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/60 space-y-2">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide block">
            Option A: Quick Predict from Dataset by Project Code
          </label>
          <div className="flex gap-3">
            <input
              placeholder="Enter Project Code (e.g. 701107, 612786, 701121)…"
              className="input flex-1 font-mono text-sm"
              value={projectCodeInput}
              onChange={e => setProjectCodeInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px bg-gray-800 flex-1" />
          <span className="text-xs text-gray-500 uppercase font-medium">OR Option B: Custom Project Features</span>
          <div className="h-px bg-gray-800 flex-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Project Name</label>
            <input name="project_name" className="input w-full" value={form.project_name} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Agency / Ministry</label>
            <input name="agency" className="input w-full" placeholder="e.g. NHAI, RVNL, AAI" value={form.agency} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">State / UT</label>
            <input name="state" className="input w-full" placeholder="e.g. Maharashtra" value={form.state} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Edition Snapshot Date</label>
            <input name="edition" type="date" className="input w-full" value={form.edition} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Date of Approval (DOA)</label>
            <input name="doa" type="date" className="input w-full" value={form.doa} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Original Target Completion</label>
            <input name="original_target_doa" type="date" className="input w-full" value={form.original_target_doa} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Sanctioned Cost (₹ Crore)</label>
            <input name="original_cost" type="number" step="0.01" className="input w-full" value={form.original_cost} onChange={onChange} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Cumulative Expenditure (₹ Crore)</label>
            <input name="cumulative_expenditure" type="number" step="0.01" className="input w-full" value={form.cumulative_expenditure} onChange={onChange} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Physical Progress (0–100 %)</label>
            <input name="physical_progress" type="number" step="0.1" min="0" max="100" className="input w-full" value={form.physical_progress} onChange={onChange} />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-6">
          <Send className="h-4 w-4" />
          {loading ? 'Executing LightGBM pipeline…' : 'Run Real ML Prediction'}
        </button>
      </form>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="card space-y-6 border-brand-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <RiskBadge riskClass={riskClass} />
                <span className="text-xs font-mono text-gray-400">
                  Decision: <strong className="text-gray-200">{result.prediction || (result.predicted_overrun ? 'LIKELY COST OVERRUN' : 'NORMAL')}</strong>
                </span>
              </div>
              <p className="text-lg font-bold text-gray-100 mt-2">
                {result.project_name || `Project Code ${result.project_code || result.project_id}`}
              </p>
              <p className="text-xs text-gray-500">{result.agency} · {result.state}</p>
            </div>

            <div className="text-right shrink-0 bg-gray-800/60 p-3.5 rounded-xl border border-gray-700">
              <p className="text-xs text-gray-400 uppercase font-medium">Cost Overrun Probability</p>
              <p className="text-3xl font-bold text-gray-100 mt-0.5">
                {prob !== null && prob !== undefined ? `${(prob * 100).toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[11px] text-gray-500">Threshold: {((result.optimal_threshold ?? 0.387) * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Model info banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-800/40 p-3 rounded-lg text-xs">
            <div>
              <span className="text-gray-500 block">Engine</span>
              <span className="text-gray-200 font-semibold">{result.model_type || 'LightGBM'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Confidence</span>
              <span className="text-gray-200 font-semibold">{result.confidence}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Validation ROC-AUC</span>
              <span className="text-gray-200 font-semibold">{result.model_metrics?.roc_auc?.toFixed(3) ?? '0.797'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Provenance</span>
              <span className="text-brand-400 font-mono font-semibold">MODEL_OUTPUT</span>
            </div>
          </div>

          {/* Tree SHAP Explainability Section */}
          {shapResult && shapResult.top_contributing_features && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand-400" />
                  Exact Tree SHAP Feature Attributions
                </h3>
                <span className="text-[11px] text-gray-500 font-mono">
                  Base Log-Odds: {shapResult.base_value_log_odds?.toFixed(3)}
                </span>
              </div>

              <p className="text-xs text-gray-400 bg-brand-950/20 border border-brand-900/40 p-3 rounded-lg">
                {shapResult.summary}
              </p>

              <div className="space-y-2">
                {shapResult.top_contributing_features.map((f, idx) => {
                  const isRiskInc = f.impact === 'INCREASES_RISK'
                  return (
                    <div
                      key={idx}
                      className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5 flex-1">
                        {isRiskInc ? (
                          <ArrowUpRight className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-200">{f.label}</p>
                          <p className="text-gray-400 text-[11px] mt-0.5">{f.explanation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <span className="text-gray-400 font-mono">
                          val: {f.value != null ? f.value : '—'}
                        </span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isRiskInc ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {f.shap_value > 0 ? `+${f.shap_value.toFixed(3)}` : f.shap_value.toFixed(3)} SHAP
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
