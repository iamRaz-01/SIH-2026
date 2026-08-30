import { useState } from 'react'
import { predictCostOverrun, explainPrediction, type PredictionResult, type ShapExplanationResult } from '../api/client'
import { Send, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass?: string }) {
  const rc = String(riskClass || 'LOW').toUpperCase()
  if (rc === 'CRITICAL' || rc === 'HIGH') return <span className="badge-danger text-[13px] px-3.5 py-1">High Risk</span>
  if (rc === 'MEDIUM') return <span className="badge-warning text-[13px] px-3.5 py-1">Medium Risk</span>
  return <span className="badge-success text-[13px] px-3.5 py-1">Low Risk</span>
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
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="border-b border-[#E2E8F0] pb-6">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-[#7C3AED]">Supervised Machine Learning</span>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1">Cost-Overrun &amp; SHAP Predictor</h1>
        <p className="text-[#475569] text-[14px] font-normal mt-1">
          Inference powered by trained LightGBM ML model calibrated on 48,894 records (ROC-AUC: 0.797 · Threshold: 38.7%)
        </p>
      </div>

      {/* ── Predict Form ── */}
      <form onSubmit={onSubmit} className="card space-y-6 shadow-xs">
        {/* Quick Project Code Lookup */}
        <div className="bg-[#F8FAFC] p-4.5 rounded-xl border border-[#E2E8F0] space-y-2">
          <label className="text-[14px] font-semibold text-[#2563EB] uppercase tracking-wider block">
            Option A: Quick Predict from Dataset by Project Code
          </label>
          <div className="flex gap-3">
            <input
              placeholder="Enter Project Code (e.g. 701107, 612786, 701121, 602096)…"
              className="input flex-1 text-[15px] placeholder:text-[15px]"
              value={projectCodeInput}
              onChange={e => setProjectCodeInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px bg-[#E2E8F0] flex-1" />
          <span className="text-[13px] font-medium uppercase tracking-wider text-[#64748B]">OR Option B: Custom Project Features</span>
          <div className="h-px bg-[#E2E8F0] flex-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Project Name</label>
            <input name="project_name" className="input w-full" placeholder="e.g. Dedicated Freight Corridor" value={form.project_name} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Implementing Agency / Ministry</label>
            <input name="agency" className="input w-full" placeholder="e.g. NHAI, RVNL, AAI, CAOCWR" value={form.agency} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">State / UT</label>
            <input name="state" className="input w-full" placeholder="e.g. Maharashtra" value={form.state} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Edition Snapshot Date</label>
            <input name="edition" type="date" className="input w-full" value={form.edition} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Date of Approval (DOA)</label>
            <input name="doa" type="date" className="input w-full" value={form.doa} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Original Target Completion</label>
            <input name="original_target_doa" type="date" className="input w-full" value={form.original_target_doa} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Sanctioned Cost (₹ Crore)</label>
            <input name="original_cost" type="number" step="0.01" className="input w-full" placeholder="e.g. 1500.00" value={form.original_cost} onChange={onChange} />
          </div>
          <div>
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Cumulative Expenditure (₹ Crore)</label>
            <input name="cumulative_expenditure" type="number" step="0.01" className="input w-full" placeholder="e.g. 1200.00" value={form.cumulative_expenditure} onChange={onChange} />
          </div>
          <div className="md:col-span-2">
            <label className="text-[14px] text-[#475569] block mb-1 font-medium">Physical Progress (0–100 %)</label>
            <input name="physical_progress" type="number" step="0.1" min="0" max="100" className="input w-full" placeholder="e.g. 75.5" value={form.physical_progress} onChange={onChange} />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary text-[14px] font-semibold py-2.5 px-6">
          <Send className="h-4 w-4" />
          {loading ? 'Executing LightGBM Pipeline…' : 'Run Real ML Prediction'}
        </button>
      </form>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 text-[#B91C1C] text-[14px]">
          {error}
        </div>
      )}

      {/* ── Prediction Result & SHAP Section ── */}
      {result && (
        <div className="card space-y-6 border-[#BFDBFE]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div>
              <div className="flex items-center gap-3">
                <RiskBadge riskClass={riskClass} />
                <span className="text-[13px] font-medium text-[#475569]">
                  Decision: <strong className="text-[#0F172A]">{result.prediction || (result.predicted_overrun ? 'LIKELY COST OVERRUN' : 'NORMAL')}</strong>
                </span>
              </div>
              <p className="text-[20px] font-bold text-[#0F172A] mt-2">
                {result.project_name || `Project Code ${result.project_code || result.project_id}`}
              </p>
              <p className="text-[13px] text-[#475569] font-normal">{result.agency} · {result.state}</p>
            </div>

            <div className="text-right shrink-0 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-[#64748B]">Overrun Probability</p>
              <p className="text-[32px] font-bold text-[#0F172A] leading-none mt-0.5">
                {prob !== null && prob !== undefined ? `${(prob * 100).toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[12px] text-[#64748B] font-normal mt-1">Threshold: {((result.optimal_threshold ?? 0.387) * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Model telemetry banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] text-[13px]">
            <div>
              <span className="text-[#64748B] block text-[11px] uppercase font-semibold">Engine</span>
              <span className="text-[#0F172A] font-semibold">{result.model_type || 'LightGBM'}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[11px] uppercase font-semibold">Confidence</span>
              <span className="text-[#0F172A] font-semibold">{result.confidence}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[11px] uppercase font-semibold">Validation ROC-AUC</span>
              <span className="text-[#0F172A] font-semibold">{result.model_metrics?.roc_auc?.toFixed(3) ?? '0.797'}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[11px] uppercase font-semibold">Provenance</span>
              <span className="text-[#2563EB] font-semibold">MODEL_OUTPUT</span>
            </div>
          </div>

          {/* Tree SHAP Explainability Breakdown */}
          {shapResult && shapResult.top_contributing_features && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-semibold text-[#0F172A] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                  Exact Tree SHAP Feature Attributions
                </h3>
                <span className="text-[12px] text-[#64748B] font-normal">
                  Base Log-Odds: {shapResult.base_value_log_odds?.toFixed(3)}
                </span>
              </div>

              <p className="text-[14px] text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-xl leading-relaxed font-normal">
                {shapResult.summary}
              </p>

              <div className="space-y-2">
                {shapResult.top_contributing_features.map((f, idx) => {
                  const isRiskInc = f.impact === 'INCREASES_RISK'
                  return (
                    <div
                      key={idx}
                      className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="flex items-start gap-2.5 flex-1">
                        {isRiskInc ? (
                          <ArrowUpRight className="h-4.5 w-4.5 text-[#DC2626] shrink-0 mt-0.5" />
                        ) : (
                          <ArrowDownRight className="h-4.5 w-4.5 text-[#16A34A] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold text-[#0F172A] text-[14px]">{f.label}</p>
                          <p className="text-[#475569] text-[13px] font-normal mt-0.5">{f.explanation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <span className="text-[#64748B] font-normal text-[12px]">
                          val: {f.value != null ? f.value : '—'}
                        </span>
                        <span
                          className={`font-semibold px-2.5 py-1 rounded-md text-[12px] ${
                            isRiskInc ? 'badge-danger' : 'badge-success'
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
