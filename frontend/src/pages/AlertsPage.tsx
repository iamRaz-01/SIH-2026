import { useEffect, useState } from 'react'
import { getAlerts, type Alert, type AlertsResponse } from '../api/client'
import { Bell, AlertOctagon, AlertTriangle, Info, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

const SEVERITY_ICON: Record<string, React.ElementType> = {
  High: AlertOctagon,
  Medium: AlertTriangle,
  Informational: Info,
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
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto bg-[#F8FAFC]">
      <div className="border-b border-[#E2E8F0] pb-6">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-[#DC2626]">Portfolio Surveillance</span>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-1 flex items-center gap-2.5">
          <Bell className="h-6 w-6 text-[#DC2626]" />
          Early-Warning Alerts
        </h1>
        <p className="text-[#475569] text-[14px] font-normal mt-1">
          Top-priority alerts derived directly from central infrastructure portfolio conditions
        </p>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-[#B91C1C] text-[14px]">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-[#64748B] text-[14px] gap-2">
          <div className="animate-spin h-6 w-6 border-2 border-[#2563EB] border-t-transparent rounded-full" />
          Loading alerts…
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {data?.alerts.map((alert: Alert, i) => {
            const isHigh = alert.severity?.toLowerCase() === 'high' || alert.severity?.toLowerCase() === 'critical'
            const isMedium = alert.severity?.toLowerCase() === 'medium'
            const Icon = SEVERITY_ICON[alert.severity] ?? AlertTriangle

            return (
              <div
                key={i}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-5 py-4 shadow-2xs hover:border-[#CBD5E1] transition border-l-4"
                style={{
                  borderLeftColor: isHigh ? '#DC2626' : isMedium ? '#F59E0B' : '#2563EB'
                }}
              >
                <div className="flex items-start gap-3.5">
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${
                    isHigh ? 'text-[#DC2626]' : isMedium ? 'text-[#D97706]' : 'text-[#2563EB]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-[#0F172A] uppercase tracking-wide">
                        {alert.title}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isHigh ? 'badge-danger' : isMedium ? 'badge-warning' : 'badge-primary'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="font-semibold text-[#0F172A] text-[15px] mt-1 line-clamp-2">
                      {alert.project_name}
                    </p>
                    <p className="text-[12px] text-[#64748B] mt-0.5 font-normal">
                      {alert.agency} · {alert.state} · Code: {alert.project_code}
                    </p>
                    <p className="text-[14px] mt-2 text-[#334155] font-normal leading-relaxed">{alert.message}</p>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#EDF2F7] text-[12px]">
                      <span className="text-[#64748B]">
                        {alert.metric_responsible}: <strong className="text-[#0F172A]">{alert.metric_value}</strong>
                      </span>
                      {alert.project_id && (
                        <Link to={`/projects/${alert.project_id}`} className="text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1">
                          View Project <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {!data?.alerts.length && !loading && (
            <div className="card text-center text-[#64748B] py-12 text-[14px]">
              No active alerts.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
