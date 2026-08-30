import { useEffect, useState } from 'react'
import { getAlerts, type Alert, type AlertsResponse } from '../api/client'
import { Bell, AlertOctagon, AlertTriangle, Info, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

const SEVERITY_ICON: Record<string, React.ElementType> = {
  High: AlertOctagon,
  Medium: AlertTriangle,
  Informational: Info,
}

const SEVERITY_STYLE: Record<string, string> = {
  High: 'border-red-800 bg-red-950/30 text-red-400',
  Medium: 'border-amber-800 bg-amber-950/30 text-amber-400',
  Informational: 'border-blue-800 bg-blue-950/30 text-blue-400',
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAlerts(5)
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Bell className="h-6 w-6 text-red-400" />
          Early-Warning Alerts
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Top-priority alerts derived directly from central infrastructure portfolio conditions
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
                      <span className="text-xs font-bold uppercase tracking-wide">
                        {alert.title}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        alert.severity === 'High' ? 'bg-red-900 text-red-300' :
                        alert.severity === 'Medium' ? 'bg-amber-900 text-amber-300' : 'bg-blue-900 text-blue-300'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-100 mt-1 line-clamp-2">
                      {alert.project_name}
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {alert.agency} · {alert.state} · Code: {alert.project_code}
                    </p>
                    <p className="text-sm mt-2 text-gray-200">{alert.message}</p>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800/50 text-xs">
                      <span className="font-mono text-gray-300">
                        {alert.metric_responsible}: <strong>{alert.metric_value}</strong>
                      </span>
                      {alert.project_id && (
                        <Link to={`/projects/${alert.project_id}`} className="text-brand-400 font-medium flex items-center gap-1">
                          View Project <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {!data?.alerts.length && !loading && (
            <div className="card text-center text-gray-500 py-12">
              No active alerts.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
