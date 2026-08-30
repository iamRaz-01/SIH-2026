import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  AlertTriangle,
  Network,
  Brain,
  Activity,
  ShieldCheck,
  Bell,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { getAlerts, type Alert } from '../api/client'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects' },
  { to: '/predict',   icon: Brain,            label: 'Risk Predictor' },
  { to: '/anomalies', icon: AlertTriangle,    label: 'Anomalies' },
  { to: '/network',   icon: Network,          label: 'Project Network' },
  { to: '/health',    icon: Activity,         label: 'System Health' },
]

export default function Layout() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [openAlerts, setOpenAlerts] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Fetch top 5 genuine alerts
  useEffect(() => {
    getAlerts(5)
      .then(res => {
        const top5 = (res.alerts || []).slice(0, 5)
        setAlerts(top5)
        setUnreadCount(top5.length)
      })
      .catch(() => setAlerts([]))
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenAlerts(false)
      }
    }
    if (openAlerts) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openAlerts])

  const handleAlertClick = (alert: Alert) => {
    setOpenAlerts(false)
    if (alert.project_id) {
      navigate(`/projects/${alert.project_id}`)
    }
  }

  const getPageTitle = () => {
    const path = location.pathname
    if (path.includes('/projects/')) return 'Project Intelligence Detail'
    if (path.includes('/projects')) return 'Infrastructure Projects'
    if (path.includes('/anomalies')) return 'Anomalies'
    if (path.includes('/network')) return 'Project Network'
    if (path.includes('/predict')) return 'Cost Overrun Predictor'
    if (path.includes('/health')) return 'System Health'
    return 'Portfolio Dashboard'
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      {/* ── Sidebar ── */}
      <aside className="w-64 shrink-0 border-r border-gray-800/80 bg-gray-900/50 flex flex-col backdrop-blur-md">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500/10 p-2 rounded-xl border border-brand-500/20">
              <ShieldCheck className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <p className="font-bold text-gray-100 text-base leading-tight tracking-tight">InfraGuard AI</p>
              <p className="text-[11px] text-gray-500 font-medium">PAIMANA Risk Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation (Alerts strictly removed) */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800/80 text-[11px] text-gray-500 space-y-0.5">
          <p className="font-semibold text-gray-400">MoSPI · IPMD Central Sector</p>
          <p className="text-[10px] text-gray-600">LightGBM Production Engine</p>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Global Header Bar */}
        <header className="h-16 shrink-0 border-b border-gray-800/80 bg-gray-900/40 backdrop-blur-md px-6 flex items-center justify-between z-30">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium">InfraGuard</span>
            <ChevronRight className="h-4 w-4 text-gray-600" />
            <span className="text-gray-200 font-semibold">{getPageTitle()}</span>
          </div>

          {/* Top-Right: Notification Bell Icon & Profile */}
          <div className="flex items-center gap-4 relative" ref={dropdownRef}>
            {/* Notification Bell Icon */}
            <div className="relative">
              <button
                onClick={() => setOpenAlerts(!openAlerts)}
                aria-label="Early-warning notifications"
                className={`relative p-2.5 rounded-xl border transition ${
                  openAlerts
                    ? 'bg-gray-800 border-gray-700 text-gray-100'
                    : 'border-gray-800 bg-gray-900 hover:bg-gray-800/70 text-gray-300 hover:text-gray-100'
                }`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown (Max 5 Top Alerts) */}
              {openAlerts && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-red-400" />
                      <h3 className="font-bold text-xs text-gray-100 uppercase tracking-wider">
                        Early-Warning Alerts (Top 5)
                      </h3>
                    </div>
                    <button
                      onClick={() => setOpenAlerts(false)}
                      className="text-gray-500 hover:text-gray-300 text-sm p-1 rounded-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-800/50">
                    {alerts.length > 0 ? (
                      alerts.map((alert, index) => {
                        const isHigh = alert.severity?.toLowerCase() === 'high' || alert.severity?.toLowerCase() === 'critical'
                        const isMedium = alert.severity?.toLowerCase() === 'medium'

                        return (
                          <div
                            key={alert.id || index}
                            onClick={() => handleAlertClick(alert)}
                            className="p-3.5 hover:bg-gray-800/60 cursor-pointer transition flex items-start gap-3 group"
                          >
                            <span className="text-base shrink-0 mt-0.5">
                              {isHigh ? '🔴' : isMedium ? '🟡' : '🔵'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isHigh ? 'text-red-400' : isMedium ? 'text-amber-400' : 'text-blue-400'
                                }`}>
                                  {alert.severity}
                                </span>
                                {alert.date && (
                                  <span className="text-[10px] text-gray-500">{alert.date}</span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-gray-200 mt-0.5 line-clamp-1 group-hover:text-brand-300">
                                {alert.title}
                              </p>
                              {alert.project_name && (
                                <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                                  {alert.project_name}
                                </p>
                              )}
                              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                                {alert.message}
                              </p>
                              <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-800/40 text-[10px]">
                                <span className="text-gray-400 font-mono">
                                  {alert.metric_responsible}: <strong className="text-gray-200">{alert.metric_value}</strong>
                                </span>
                                {alert.project_id && (
                                  <span className="text-brand-400 font-medium flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                                    View Project <ExternalLink className="h-2.5 w-2.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-gray-500">
                        No active early-warning alerts.
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2.5 bg-gray-950/60 border-t border-gray-800 text-[11px] text-gray-500 text-center">
                    Prioritized in real-time from MoSPI dataset metrics
                  </div>
                </div>
              )}
            </div>

            {/* Admin Profile Tag */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-800">
              <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 flex items-center justify-center font-bold text-xs">
                AD
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-gray-200 leading-tight">Admin Console</p>
                <p className="text-[10px] text-gray-500">MoSPI Officer</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
