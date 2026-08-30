import { useEffect, useState } from 'react'
import { getAlerts, type Alert, type AlertsResponse } from '../api/client'
import { Bell, AlertOctagon, AlertTriangle } from 'lucide-react'

const SEVERITY_ICON: Record<string, React.ElementType> = {
  Critical: AlertOctagon,
  High: AlertTriangle,
}

const SEVERITY_STYLE: Record<string, string> = {
  Critical: 'border-red-800 bg-red-950/30 text-red-400',
  High: 'border-amber-800 bg-amber-950/30 text-amber-400',
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAlerts(50)
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Bell className="h-6 w-6 text-red-400" />
          Early-Warning Alerts
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Rule-based triggers: severe cost overrun (&gt;50%) and expenditure-progress mismatch (&gt;30pp)
        </p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {data?.alerts.map((alert: Alert, i) => {
            const Icon = SEVERITY_ICON[alert.severity] ?? AlertTriangle
            const style = SEVERITY_STYLE[alert.severity] ?? 'border-gray-700 bg-gray-800/30 text-gray-400'
            return (
              <div key={i} className={`border rounded-xl px-5 py-4 ${style}`}>
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono uppercase tracking-wide opacity-70">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        alert.severity === 'Critical' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-100 mt-1 line-clamp-2">
                      {alert.project_name}
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {alert.agency} · {alert.state}
                    </p>
                    <p className="text-sm mt-2">{alert.message}</p>
                    <div className="flex gap-4 mt-2 text-xs opacity-60">
                      {alert.cost_overrun_ratio !== null && (
                        <span>Cost overrun: {(alert.cost_overrun_ratio * 100).toFixed(1)}%</span>
                      )}
                      {alert.physical_progress !== null && (
                        <span>Progress: {alert.physical_progress.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {!data?.alerts.length && !loading && (
            <div className="card text-center text-gray-500 py-12">
              No alerts triggered — all projects within thresholds.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
