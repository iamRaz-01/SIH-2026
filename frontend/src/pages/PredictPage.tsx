import { useState, useEffect, useMemo } from 'react'
import {
  predictCostOverrun,
  explainPrediction,
  getProject,
  getProjects,
  type PredictionResult,
  type ShapExplanationResult,
  type Project,
  type ShapFeature,
} from '../api/client'
import {
  Sparkles,
  RotateCcw,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  History,
  SlidersHorizontal,
  Info,
} from 'lucide-react'

function RiskBadge({ riskClass }: { riskClass?: string }) {
  const rc = String(riskClass || 'LOW').toUpperCase()
  if (rc === 'CRITICAL' || rc === 'HIGH') return <span className="badge-danger text-[12px] px-3 py-0.5">High Risk</span>
  if (rc === 'MEDIUM') return <span className="badge-warning text-[12px] px-3 py-0.5">Medium Risk</span>
  return <span className="badge-success text-[12px] px-3 py-0.5">Low Risk</span>
}

interface ScenarioHistoryItem {
  id: string
  name: string
  timestamp: string
  originalCost: number
  expenditure: number
  progress: number
  probability: number
  riskClass: string
  deltaPp: number
}

const SAMPLE_PROJECT_CODES = [
  { code: '701107', label: 'NHAI Highway Package' },
  { code: '602096', label: 'East Coast Railway Work' },
  { code: '701121', label: 'AAI Airport Terminal' },
  { code: '612786', label: 'IOCL Pipeline Project' },
  { code: '705453', label: 'Western Railway Rail Line' },
]

export default function PredictPage() {
  const [activeTab, setActiveTab] = useState<'scenario' | 'custom'>('scenario')

  // Search & Project Code selection
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Project[]>([])

  // Baseline Immutable State
  const [baselineProject, setBaselineProject] = useState<Project | null>(null)
  const [baselinePred, setBaselinePred] = useState<PredictionResult | null>(null)
  const [baselineShap, setBaselineShap] = useState<ShapExplanationResult | null>(null)
  const [loadingBaseline, setLoadingBaseline] = useState(false)

  // Scenario Mutable State
  const [scenarioForm, setScenarioForm] = useState({
    original_cost: '',
    cumulative_expenditure: '',
    physical_progress: '',
    original_target_doa: '',
    doa: '',
    edition: '',
  })

  // Scenario Prediction & SHAP
  const [scenarioPred, setScenarioPred] = useState<PredictionResult | null>(null)
  const [scenarioShap, setScenarioShap] = useState<ShapExplanationResult | null>(null)
  const [loadingScenario, setLoadingScenario] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)

  // Custom Form State (for Tab 2)
  const [customForm, setCustomForm] = useState({
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
  const [customPred, setCustomPred] = useState<PredictionResult | null>(null)
  const [loadingCustom, setLoadingCustom] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

  // Session Scenario History
  const [history, setHistory] = useState<ScenarioHistoryItem[]>([])

  // Search auto-complete
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const t = setTimeout(() => {
      getProjects({ search: searchQuery, page_size: 5 })
        .then(res => setSearchResults(res.projects || []))
        .catch(() => setSearchResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Load project baseline when selected
  const loadProjectBaseline = (codeOrId: string) => {
    setLoadingBaseline(true)
    setScenarioError(null)
    setScenarioPred(null)
    setScenarioShap(null)

    getProject(codeOrId)
      .then(proj => {
        setBaselineProject(proj)
        const origCost = proj.original_cost != null ? String(proj.original_cost) : ''
        const cumExp = proj.cumulative_expenditure != null ? String(proj.cumulative_expenditure) : ''
        const physProg = proj.physical_progress != null ? String(proj.physical_progress) : ''
        const doa = proj.doa ? String(proj.doa).split('T')[0] : ''
        const targetDoa = proj.original_target_doa ? String(proj.original_target_doa).split('T')[0] : ''
        const edition = proj.edition ? String(proj.edition).split('T')[0] : ''

        // Set scenario clone
        setScenarioForm({
          original_cost: origCost,
          cumulative_expenditure: cumExp,
          physical_progress: physProg,
          original_target_doa: targetDoa,
          doa,
          edition,
        })

        // Run Baseline ML Prediction & SHAP
        const payload = {
          project_code: proj.project_code || proj.project_id,
          original_cost: proj.original_cost != null ? Number(proj.original_cost) : undefined,
          cumulative_expenditure: proj.cumulative_expenditure != null ? Number(proj.cumulative_expenditure) : undefined,
          physical_progress: proj.physical_progress != null ? Number(proj.physical_progress) : undefined,
          agency: proj.agency,
          state: proj.state,
          project_name: proj.project_name,
          doa,
          original_target_doa: targetDoa,
          edition,
        }

        return Promise.all([
          predictCostOverrun(payload),
          explainPrediction(payload, 8).catch(() => null),
        ])
      })
      .then(([pred, shap]) => {
        setBaselinePred(pred)
        setBaselineShap(shap)
      })
      .catch(e => {
        setScenarioError(`Failed to load project "${codeOrId}": ${e}`)
      })
      .finally(() => setLoadingBaseline(false))
  }

  // Load initial default project
  useEffect(() => {
    loadProjectBaseline('701107')
  }, [])

  // Run What-If Scenario Prediction
  const onRunScenario = () => {
    if (!baselineProject) return

    // Validation
    const origCostNum = Number(scenarioForm.original_cost)
    const cumExpNum = Number(scenarioForm.cumulative_expenditure)
    const progNum = Number(scenarioForm.physical_progress)

    if (isNaN(origCostNum) || origCostNum < 0) {
      setScenarioError('Sanctioned Cost must be a positive numeric value in ₹ Crore.')
      return
    }
    if (isNaN(cumExpNum) || cumExpNum < 0) {
      setScenarioError('Cumulative Expenditure must be a non-negative numeric value.')
      return
    }
    if (isNaN(progNum) || progNum < 0 || progNum > 100) {
      setScenarioError('Physical Progress must be between 0% and 100%.')
      return
    }

    setLoadingScenario(true)
    setScenarioError(null)

    // Complete Scenario Payload (Baseline Metadata + Scenario Overrides)
    const scenarioPayload = {
      project_code: baselineProject.project_code || baselineProject.project_id,
      project_name: baselineProject.project_name,
      agency: baselineProject.agency,
      state: baselineProject.state,
      doa: scenarioForm.doa || baselineProject.doa,
      original_target_doa: scenarioForm.original_target_doa || baselineProject.original_target_doa,
      edition: scenarioForm.edition || baselineProject.edition,
      original_cost: origCostNum,
      cumulative_expenditure: cumExpNum,
      physical_progress: progNum,
    }

    Promise.all([
      predictCostOverrun(scenarioPayload),
      explainPrediction(scenarioPayload, 8).catch(() => null),
    ])
      .then(([pred, shap]) => {
        setScenarioPred(pred)
        setScenarioShap(shap)

        // Add to history shelf
        if (pred && baselinePred) {
          const baseProb = baselinePred.cost_overrun_probability ?? 0
          const scenProb = pred.cost_overrun_probability ?? 0
          const delta = (scenProb - baseProb) * 100

          const newItem: ScenarioHistoryItem = {
            id: `scen_${Date.now()}`,
            name: `Cost: ₹${origCostNum}Cr · Prog: ${progNum}%`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            originalCost: origCostNum,
            expenditure: cumExpNum,
            progress: progNum,
            probability: scenProb,
            riskClass: pred.risk_level || pred.risk_class || 'LOW',
            deltaPp: delta,
          }
          setHistory(prev => [newItem, ...prev.slice(0, 4)])
        }
      })
      .catch(e => setScenarioError(String(e)))
      .finally(() => setLoadingScenario(false))
  }

  // Reset Scenario to Baseline values
  const onResetScenario = () => {
    if (!baselineProject) return
    setScenarioForm({
      original_cost: baselineProject.original_cost != null ? String(baselineProject.original_cost) : '',
      cumulative_expenditure: baselineProject.cumulative_expenditure != null ? String(baselineProject.cumulative_expenditure) : '',
      physical_progress: baselineProject.physical_progress != null ? String(baselineProject.physical_progress) : '',
      original_target_doa: baselineProject.original_target_doa ? String(baselineProject.original_target_doa).split('T')[0] : '',
      doa: baselineProject.doa ? String(baselineProject.doa).split('T')[0] : '',
      edition: baselineProject.edition ? String(baselineProject.edition).split('T')[0] : '',
    })
    setScenarioPred(null)
    setScenarioShap(null)
    setScenarioError(null)
  }

  // Quick Preset Handlers
  const applyCostPreset = (multiplier: number) => {
    const base = Number(baselineProject?.original_cost || scenarioForm.original_cost)
    if (!isNaN(base) && base > 0) {
      setScenarioForm(f => ({ ...f, original_cost: (base * multiplier).toFixed(1) }))
    }
  }

  const applyProgressPreset = (delta: number) => {
    const base = Number(scenarioForm.physical_progress || 0)
    const newProg = Math.max(0, Math.min(100, base + delta))
    setScenarioForm(f => ({ ...f, physical_progress: String(newProg) }))
  }

  // Delta Calculations
  const deltaMetrics = useMemo(() => {
    if (!baselinePred || !scenarioPred) return null
    const baseProb = baselinePred.cost_overrun_probability ?? 0
    const scenProb = scenarioPred.cost_overrun_probability ?? 0
    const deltaPp = (scenProb - baseProb) * 100
    const isIncreased = deltaPp > 0.05
    const isDecreased = deltaPp < -0.05

    return {
      baseProbPct: (baseProb * 100).toFixed(1),
      scenProbPct: (scenProb * 100).toFixed(1),
      deltaPp: deltaPp.toFixed(1),
      isIncreased,
      isDecreased,
      baseRiskClass: baselinePred.risk_level || baselinePred.risk_class || 'LOW',
      scenRiskClass: scenarioPred.risk_level || scenarioPred.risk_class || 'LOW',
    }
  }, [baselinePred, scenarioPred])

  // SHAP Delta Map
  const shapDeltaList = useMemo(() => {
    if (!baselineShap?.top_contributing_features || !scenarioShap?.top_contributing_features) return []

    const baseMap = new Map<string, ShapFeature>()
    baselineShap.top_contributing_features.forEach(f => baseMap.set(f.feature, f))

    const list: Array<{
      feature: string
      label: string
      baseShap: number
      scenShap: number
      deltaShap: number
      explanation: string
    }> = []

    scenarioShap.top_contributing_features.forEach(scenF => {
      const baseF = baseMap.get(scenF.feature)
      const bVal = baseF ? baseF.shap_value : 0
      const sVal = scenF.shap_value
      const diff = sVal - bVal

      list.push({
        feature: scenF.feature,
        label: scenF.label,
        baseShap: bVal,
        scenShap: sVal,
        deltaShap: diff,
        explanation: scenF.explanation,
      })
    })

    return list.sort((a, b) => Math.abs(b.deltaShap) - Math.abs(a.deltaShap)).slice(0, 6)
  }, [baselineShap, scenarioShap])

  // Out-of-Distribution Warning Check
  const oodWarning = useMemo(() => {
    const cost = Number(scenarioForm.original_cost)
    if (cost > 80000) {
      return 'Sanctioned Cost is unusually high (> ₹80,000 Cr). Prediction reliability may be reduced.'
    }
    return null
  }, [scenarioForm.original_cost])

  // Custom Form submit
  const onCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingCustom(true)
    setCustomError(null)
    setCustomPred(null)

    const payload = {
      project_name: customForm.project_name || undefined,
      agency: customForm.agency || undefined,
      state: customForm.state || undefined,
      doa: customForm.doa || undefined,
      original_target_doa: customForm.original_target_doa || undefined,
      original_cost: customForm.original_cost ? Number(customForm.original_cost) : undefined,
      cumulative_expenditure: customForm.cumulative_expenditure ? Number(customForm.cumulative_expenditure) : undefined,
      physical_progress: customForm.physical_progress ? Number(customForm.physical_progress) : undefined,
      edition: customForm.edition || undefined,
    }

    predictCostOverrun(payload)
      .then(pred => {
        setCustomPred(pred)
      })
      .catch(e => setCustomError(String(e)))
      .finally(() => setLoadingCustom(false))
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-[#F8FAFC]">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#7C3AED] flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            Supervised Machine Learning
          </span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1">
            Cost-Overrun &amp; What-If Scenario Predictor
          </h1>
          <p className="text-[#475569] text-[14px] font-normal mt-1">
            Simulate hypothetical parameter modifications on authentic project baselines using the calibrated LightGBM model.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-[#FFFFFF] p-1 rounded-xl border border-[#E2E8F0] shadow-2xs self-start md:self-auto">
          <button
            onClick={() => setActiveTab('scenario')}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition ${
              activeTab === 'scenario'
                ? 'bg-[#0F172A] text-[#FFFFFF] shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            What-If Scenario
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition ${
              activeTab === 'custom'
                ? 'bg-[#0F172A] text-[#FFFFFF] shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <Plus className="h-4 w-4" />
            Custom Project Input
          </button>
        </div>
      </div>

      {/* ── TAB 1: WHAT-IF SCENARIO PREDICTOR ── */}
      {activeTab === 'scenario' && (
        <div className="space-y-6">
          {/* Project Selector Bar */}
          <div className="card p-4.5 bg-[#FFFFFF] space-y-3 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  className="input w-full pl-10 text-[14px]"
                  placeholder="Search project code or name (e.g. 701107)…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[#EDF2F7]">
                    {searchResults.map(p => (
                      <button
                        key={p.project_id}
                        onClick={() => {
                          const code = p.project_code || p.project_id
                          loadProjectBaseline(code)
                          setSearchQuery('')
                          setSearchResults([])
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[#F8FAFC] transition flex items-center justify-between text-[13px]"
                      >
                        <div className="truncate flex-1">
                          <p className="font-semibold text-[#0F172A] truncate">{p.project_name}</p>
                          <p className="text-[11px] text-[#64748B]">Code: {p.project_code || p.project_id} · {p.agency}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#2563EB] shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Sample Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] text-[#64748B] font-medium mr-1">Quick Select:</span>
                {SAMPLE_PROJECT_CODES.map(sample => (
                  <button
                    key={sample.code}
                    onClick={() => {
                      loadProjectBaseline(sample.code)
                    }}
                    className={`text-[12px] px-2.5 py-1 rounded-lg border transition font-medium ${
                      baselineProject && (baselineProject.project_code === sample.code || baselineProject.project_id === sample.code)
                        ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {sample.code}
                  </button>
                ))}
              </div>
            </div>

            {loadingBaseline && (
              <div className="flex items-center gap-2 text-[13px] text-[#2563EB] pt-1">
                <div className="animate-spin h-3.5 w-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full" />
                Loading authentic project record and calculating baseline ML prediction…
              </div>
            )}
          </div>

          {scenarioError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-[#B91C1C] text-[14px]">
              {scenarioError}
            </div>
          )}

          {oodWarning && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 text-[#B45309] text-[13px] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#D97706]" />
              <span>{oodWarning}</span>
            </div>
          )}

          {/* ── Dual Workspace: Baseline vs Scenario Playground ── */}
          {baselineProject && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Column A: Immutable Baseline Overview */}
              <div className="card p-5 bg-[#FFFFFF] space-y-4 shadow-xs border-l-4 border-l-[#2563EB]">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider">
                      Current Reality (Baseline)
                    </span>
                    <h3 className="text-[17px] font-bold text-[#0F172A] line-clamp-1 mt-0.5">
                      {baselineProject.project_name}
                    </h3>
                  </div>
                  <RiskBadge riskClass={baselinePred?.risk_level || baselinePred?.risk_class} />
                </div>

                <div className="text-[12px] text-[#64748B] space-y-0.5">
                  <p>Code: <strong className="text-[#0F172A]">{baselineProject.project_code || baselineProject.project_id}</strong></p>
                  <p>Agency: <span className="text-[#334155]">{baselineProject.agency}</span> · State: <span className="text-[#334155]">{baselineProject.state}</span></p>
                </div>

                {/* Baseline Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-[13px] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Sanctioned Cost</span>
                    <p className="font-bold text-[#0F172A] mt-0.5">
                      ₹{Number(baselineProject.original_cost || 0).toLocaleString()} Cr
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Expenditure</span>
                    <p className="font-bold text-[#0F172A] mt-0.5">
                      ₹{Number(baselineProject.cumulative_expenditure || 0).toLocaleString()} Cr
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Physical Progress</span>
                    <p className="font-bold text-[#15803D] mt-0.5">
                      {baselineProject.physical_progress != null ? `${baselineProject.physical_progress}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Approval Date (DOA)</span>
                    <p className="font-semibold text-[#0F172A] mt-0.5">
                      {baselineProject.doa ? String(baselineProject.doa).split('T')[0] : '—'}
                    </p>
                  </div>
                </div>

                {/* Baseline ML Score Banner */}
                {baselinePred && (
                  <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-[#1D4ED8] uppercase tracking-wide">
                        Baseline Overrun Probability
                      </span>
                      <p className="text-[26px] font-bold text-[#1D4ED8] leading-none mt-0.5">
                        {baselinePred.cost_overrun_probability != null
                          ? `${(baselinePred.cost_overrun_probability * 100).toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-[#475569]">
                      <span>Threshold: {((baselinePred.optimal_threshold ?? 0.387) * 100).toFixed(1)}%</span>
                      <p className="font-semibold text-[#0F172A] mt-0.5">{baselinePred.prediction}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Column B: Interactive What-If Scenario Playground */}
              <div className="card p-5 bg-[#FFFFFF] space-y-4 shadow-xs border-l-4 border-l-[#7C3AED]">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#7C3AED] uppercase tracking-wider">
                      Hypothetical Scenario (What-If)
                    </span>
                    <h3 className="text-[17px] font-bold text-[#0F172A] mt-0.5">
                      Modify Project Parameters
                    </h3>
                  </div>
                  <button
                    onClick={onResetScenario}
                    className="text-[12px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 font-medium bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-lg"
                    title="Reset all scenario values to baseline"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>

                <div className="space-y-3.5">
                  {/* Parameter 1: Sanctioned Cost */}
                  <div>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <label className="font-semibold text-[#0F172A]">Sanctioned Cost (₹ Crore)</label>
                      <div className="flex gap-1 text-[11px]">
                        <button onClick={() => applyCostPreset(0.85)} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">-15%</button>
                        <button onClick={() => applyCostPreset(1.10)} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">+10%</button>
                        <button onClick={() => applyCostPreset(1.25)} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">+25%</button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      className="input w-full font-semibold"
                      value={scenarioForm.original_cost}
                      onChange={e => setScenarioForm(f => ({ ...f, original_cost: e.target.value }))}
                    />
                  </div>

                  {/* Parameter 2: Cumulative Expenditure */}
                  <div>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <label className="font-semibold text-[#0F172A]">Cumulative Expenditure (₹ Crore)</label>
                      <div className="flex gap-1 text-[11px]">
                        <button onClick={() => {
                          const base = Number(scenarioForm.cumulative_expenditure || 0)
                          setScenarioForm(f => ({ ...f, cumulative_expenditure: (base * 1.15).toFixed(1) }))
                        }} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">+15%</button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      className="input w-full font-semibold"
                      value={scenarioForm.cumulative_expenditure}
                      onChange={e => setScenarioForm(f => ({ ...f, cumulative_expenditure: e.target.value }))}
                    />
                  </div>

                  {/* Parameter 3: Physical Progress */}
                  <div>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <label className="font-semibold text-[#0F172A]">
                        Physical Progress: <span className="text-[#15803D] font-bold">{scenarioForm.physical_progress || 0}%</span>
                      </label>
                      <div className="flex gap-1 text-[11px]">
                        <button onClick={() => applyProgressPreset(10)} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">+10%</button>
                        <button onClick={() => applyProgressPreset(25)} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">+25%</button>
                        <button onClick={() => setScenarioForm(f => ({ ...f, physical_progress: '100' }))} className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] font-medium">100%</button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full accent-[#7C3AED] h-2 bg-[#E2E8F0] rounded-lg cursor-pointer"
                      value={scenarioForm.physical_progress || 0}
                      onChange={e => setScenarioForm(f => ({ ...f, physical_progress: e.target.value }))}
                    />
                  </div>

                  {/* Parameter 4: Target Completion Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-semibold text-[#475569] block mb-1">Target Completion</label>
                      <input
                        type="date"
                        className="input w-full text-[13px]"
                        value={scenarioForm.original_target_doa}
                        onChange={e => setScenarioForm(f => ({ ...f, original_target_doa: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-[#475569] block mb-1">Approval Date (DOA)</label>
                      <input
                        type="date"
                        className="input w-full text-[13px]"
                        value={scenarioForm.doa}
                        onChange={e => setScenarioForm(f => ({ ...f, doa: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Run What-If Prediction Button */}
                <button
                  onClick={onRunScenario}
                  disabled={loadingScenario}
                  className="btn-primary w-full text-[14px] font-bold py-2.5 flex items-center justify-center gap-2 mt-2 shadow-xs"
                >
                  <Play className="h-4 w-4" />
                  {loadingScenario ? 'Executing LightGBM What-If Simulation…' : 'Run What-If Prediction'}
                </button>
              </div>
            </div>
          )}

          {/* ── Comparative Impact Results ── */}
          {deltaMetrics && (
            <div className="card p-6 bg-[#FFFFFF] space-y-6 shadow-sm border border-[#DDD6FE]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                <div>
                  <span className="text-[12px] font-bold text-[#7C3AED] uppercase tracking-wider">
                    Comparative Model Intelligence
                  </span>
                  <h3 className="text-[20px] font-bold text-[#0F172A] mt-0.5">
                    Baseline vs Scenario Impact
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-[#64748B] uppercase font-semibold">Overrun Risk Shift</span>
                    <p className={`text-[20px] font-bold ${
                      deltaMetrics.isIncreased ? 'text-[#DC2626]' : deltaMetrics.isDecreased ? 'text-[#15803D]' : 'text-[#475569]'
                    }`}>
                      {Number(deltaMetrics.deltaPp) > 0 ? `+${deltaMetrics.deltaPp}` : deltaMetrics.deltaPp} percentage points
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparison Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <span className="text-[12px] text-[#64748B] font-semibold uppercase">Baseline Overrun Risk</span>
                  <p className="text-[28px] font-bold text-[#0F172A] mt-1">{deltaMetrics.baseProbPct}%</p>
                  <p className="text-[12px] text-[#475569] mt-0.5 font-medium">{deltaMetrics.baseRiskClass} Risk Tier</p>
                </div>

                <div className="bg-[#F5F3FF] p-4 rounded-xl border border-[#DDD6FE]">
                  <span className="text-[12px] text-[#7C3AED] font-semibold uppercase">Scenario Overrun Risk</span>
                  <p className="text-[28px] font-bold text-[#7C3AED] mt-1">{deltaMetrics.scenProbPct}%</p>
                  <p className="text-[12px] text-[#7C3AED] mt-0.5 font-medium">{deltaMetrics.scenRiskClass} Risk Tier</p>
                </div>

                <div className={`p-4 rounded-xl border ${
                  deltaMetrics.isIncreased ? 'bg-[#FEF2F2] border-[#FECACA]' : deltaMetrics.isDecreased ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}>
                  <span className="text-[12px] font-semibold uppercase text-[#64748B]">Impact Direction</span>
                  <p className={`text-[28px] font-bold mt-1 ${
                    deltaMetrics.isIncreased ? 'text-[#DC2626]' : deltaMetrics.isDecreased ? 'text-[#15803D]' : 'text-[#475569]'
                  }`}>
                    {deltaMetrics.isIncreased ? '▲ Risk Elevated' : deltaMetrics.isDecreased ? '▼ Risk Reduced' : '— Neutral Shift'}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-0.5">Threshold: 38.7%</p>
                </div>
              </div>

              {/* Model Decision Interpretation */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-1.5 text-[14px] text-[#334155]">
                <p className="font-semibold text-[#0F172A] flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-[#2563EB]" />
                  Model Interpretation:
                </p>
                <p className="leading-relaxed font-normal">
                  {deltaMetrics.isIncreased ? (
                    <>Under this hypothetical scenario, the trained LightGBM model estimates an <strong className="text-[#DC2626]">increased cost-overrun probability from {deltaMetrics.baseProbPct}% to {deltaMetrics.scenProbPct}% (+{deltaMetrics.deltaPp} pp)</strong>.</>
                  ) : deltaMetrics.isDecreased ? (
                    <>Under this hypothetical scenario, the trained LightGBM model estimates a <strong className="text-[#15803D]">reduced cost-overrun probability from {deltaMetrics.baseProbPct}% to {deltaMetrics.scenProbPct}% ({deltaMetrics.deltaPp} pp)</strong>.</>
                  ) : (
                    <>The scenario parameter adjustments result in negligible shift in predicted cost-overrun probability ({deltaMetrics.baseProbPct}% vs {deltaMetrics.scenProbPct}%).</>
                  )}
                </p>
              </div>

              {/* Tree SHAP Attributions & Delta */}
              {shapDeltaList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-[16px] text-[#0F172A] flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                      Why Did the Prediction Change? (Tree SHAP Deltas)
                    </h4>
                    <span className="text-[12px] text-[#64748B]">Exact TreeExplainer feature shifts</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {shapDeltaList.map((item, idx) => {
                      const isRiskUp = item.deltaShap > 0.005
                      const isRiskDown = item.deltaShap < -0.005

                      return (
                        <div key={idx} className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1.5 text-[13px]">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#0F172A]">{item.label}</span>
                            <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                              isRiskUp ? 'badge-danger' : isRiskDown ? 'badge-success' : 'badge-neutral'
                            }`}>
                              {item.deltaShap > 0 ? `+${item.deltaShap.toFixed(3)}` : item.deltaShap.toFixed(3)} ΔSHAP
                            </span>
                          </div>
                          <p className="text-[12px] text-[#64748B] leading-snug">{item.explanation}</p>
                          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-1 border-t border-[#EDF2F7]">
                            <span>Baseline: {item.baseShap > 0 ? `+${item.baseShap.toFixed(3)}` : item.baseShap.toFixed(3)}</span>
                            <span>Scenario: {item.scenShap > 0 ? `+${item.scenShap.toFixed(3)}` : item.scenShap.toFixed(3)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Scientific Notice on Time Delay */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] text-[12px] text-[#64748B] flex items-center gap-2.5">
                <Info className="h-4.5 w-4.5 text-[#2563EB] shrink-0" />
                <span>
                  <strong>Scientific Integrity Note:</strong> Time-delay duration (months) regression prediction is not available from the current LightGBM model. Only verified classification probabilities and Tree SHAP attributions are displayed.
                </span>
              </div>
            </div>
          )}

          {/* ── Session Scenario History Shelf ── */}
          {history.length > 0 && (
            <div className="card p-5 bg-[#FFFFFF] space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                <div className="flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-[#2563EB]" />
                  <h4 className="font-semibold text-[15px] text-[#0F172A]">Session Scenario History</h4>
                </div>
                <button
                  onClick={() => setHistory([])}
                  className="text-[12px] text-[#64748B] hover:text-[#DC2626] flex items-center gap-1 font-medium"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {history.map(item => (
                  <div key={item.id} className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] text-[12px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0F172A]">{item.timestamp}</span>
                      <span className={`font-semibold ${item.deltaPp > 0 ? 'text-[#DC2626]' : 'text-[#15803D]'}`}>
                        {item.deltaPp > 0 ? `+${item.deltaPp.toFixed(1)}` : item.deltaPp.toFixed(1)} pp
                      </span>
                    </div>
                    <p className="text-[#64748B] text-[11px] truncate">{item.name}</p>
                    <p className="font-semibold text-[#0F172A] text-[13px] pt-1">
                      Risk: {(item.probability * 100).toFixed(1)}% ({item.riskClass})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CUSTOM PROJECT INFERENCE ── */}
      {activeTab === 'custom' && (
        <form onSubmit={onCustomSubmit} className="card p-6 bg-[#FFFFFF] space-y-6 shadow-xs">
          <div>
            <h3 className="text-[18px] font-semibold text-[#0F172A]">Manual Project Feature Inference</h3>
            <p className="text-[14px] text-[#475569] font-normal mt-0.5">
              Score arbitrary project inputs through the production LightGBM pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">Project Name</label>
              <input name="project_name" className="input w-full" placeholder="e.g. Western Dedicated Freight Corridor" value={customForm.project_name} onChange={e => setCustomForm(f => ({ ...f, project_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">Agency / Ministry</label>
              <input name="agency" className="input w-full" placeholder="e.g. NHAI, RVNL, AAI" value={customForm.agency} onChange={e => setCustomForm(f => ({ ...f, agency: e.target.value }))} />
            </div>
            <div>
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">State / UT</label>
              <input name="state" className="input w-full" placeholder="e.g. Maharashtra" value={customForm.state} onChange={e => setCustomForm(f => ({ ...f, state: e.target.value }))} />
            </div>
            <div>
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">Snapshot Date</label>
              <input name="edition" type="date" className="input w-full" value={customForm.edition} onChange={e => setCustomForm(f => ({ ...f, edition: e.target.value }))} />
            </div>
            <div>
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">Sanctioned Cost (₹ Crore)</label>
              <input name="original_cost" type="number" step="0.1" className="input w-full" placeholder="e.g. 1200.0" value={customForm.original_cost} onChange={e => setCustomForm(f => ({ ...f, original_cost: e.target.value }))} />
            </div>
            <div>
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">Cumulative Expenditure (₹ Crore)</label>
              <input name="cumulative_expenditure" type="number" step="0.1" className="input w-full" placeholder="e.g. 900.0" value={customForm.cumulative_expenditure} onChange={e => setCustomForm(f => ({ ...f, cumulative_expenditure: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[14px] text-[#475569] block mb-1 font-medium">Physical Progress (0–100 %)</label>
              <input name="physical_progress" type="number" step="0.1" min="0" max="100" className="input w-full" placeholder="e.g. 65.0" value={customForm.physical_progress} onChange={e => setCustomForm(f => ({ ...f, physical_progress: e.target.value }))} />
            </div>
          </div>

          <button type="submit" disabled={loadingCustom} className="btn-primary text-[14px] font-semibold py-2.5 px-6">
            {loadingCustom ? 'Executing Pipeline…' : 'Run ML Inference'}
          </button>

          {customError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-[#B91C1C] text-[14px]">
              {customError}
            </div>
          )}

          {customPred && (
            <div className="bg-[#F8FAFC] p-4.5 rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] text-[#64748B] uppercase font-semibold">Predicted Probability</span>
                  <p className="text-[26px] font-bold text-[#0F172A] leading-none mt-0.5">
                    {customPred.cost_overrun_probability != null ? `${(customPred.cost_overrun_probability * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
                <RiskBadge riskClass={customPred.risk_level || customPred.risk_class} />
              </div>
              <p className="text-[13px] text-[#475569]">Decision: <strong className="text-[#0F172A]">{customPred.prediction}</strong> (Threshold: {((customPred.optimal_threshold ?? 0.387) * 100).toFixed(1)}%)</p>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
