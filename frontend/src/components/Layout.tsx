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
  ShieldAlert,
  Bell,
  X,
  ExternalLink,
  ChevronRight,
  Search,
  Star,
  CheckCircle2,
} from 'lucide-react'
import { getAlerts, type Alert } from '../api/client'
import { useWatchlist } from '../context/WatchlistContext'
import GlobalSearchModal from './GlobalSearchModal'
import WatchlistDrawer from './WatchlistDrawer'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects' },
  { to: '/risk',      icon: ShieldAlert,     label: 'Risk Intelligence' },
  { to: '/predict',   icon: Brain,           label: 'Risk Predictor' },
  { to: '/anomalies', icon: AlertTriangle,   label: 'Anomalies' },
  { to: '/network',   icon: Network,         label: 'Project Network' },
  { to: '/health',    icon: Activity,        label: 'System Health' },
]

export default function Layout() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [openAlerts, setOpenAlerts] = useState(false)
  const [openSearch, setOpenSearch] = useState(false)
  const [openWatchlist, setOpenWatchlist] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { watchedItems } = useWatchlist()

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

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpenSearch(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
    if (path.includes('/risk')) return 'Risk Intelligence'
    if (path.includes('/anomalies')) return 'Anomalies'
    if (path.includes('/network')) return 'Project Network'
    if (path.includes('/predict')) return 'Cost Overrun Predictor'
    if (path.includes('/health')) return 'System Health'
    return 'Portfolio Dashboard'
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* ── Sidebar (Clean White #FFFFFF, Border #E2E8F0, Active #0F172A) ── */}
      <aside className="w-64 shrink-0 border-r border-[#E2E8F0] bg-[#FFFFFF] flex flex-col">
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="bg-[#EFF6FF] p-2.5 rounded-xl border border-[#DBEAFE] text-[#2563EB]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-[18px] leading-tight tracking-tight">InfraGuard AI</p>
              <p className="text-[13px] text-[#64748B] font-normal mt-0.5">PAIMANA Risk Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[16px] transition ${
                  isActive
                    ? 'bg-[#0F172A] text-[#FFFFFF] font-semibold shadow-xs'
                    : 'text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#FFFFFF]' : 'text-[#94A3B8]'}`} />
                    <span>{label}</span>
                  </div>
                  {to === '/projects' && watchedItems.length > 0 && (
                    <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-[#1E293B] text-[#FBBF24]' : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                    }`}>
                      {watchedItems.length}★
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="px-5 py-4 border-t border-[#E2E8F0] text-[13px] text-[#64748B] space-y-1 bg-[#F8FAFC]">
          <div className="flex items-center gap-1.5 text-[#0F172A] font-medium">
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
            <span>MoSPI · IPMD Central</span>
          </div>
          <p className="text-[12px] text-[#94A3B8] font-normal">LightGBM · ROC-AUC 0.797</p>
        </div>
      </aside>

      {/* ── Main Layout Column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar (#FFFFFF Background, #E2E8F0 Border) */}
        <header className="h-16 shrink-0 border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 flex items-center justify-between z-30 shadow-xs">
          {/* Breadcrumb & Title */}
          <div className="flex items-center gap-2">
            <span className="text-[#64748B] text-[14px] font-normal">InfraGuard</span>
            <ChevronRight className="h-3.5 w-3.5 text-[#CBD5E1]" />
            <span className="text-[#0F172A] text-[18px] font-semibold">{getPageTitle()}</span>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* Global Search Button Trigger (#F8FAFC background, #E2E8F0 border) */}
            <button
              onClick={() => setOpenSearch(true)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] hover:border-[#CBD5E1] text-[15px] font-normal text-[#64748B] hover:text-[#0F172A] transition shadow-2xs"
            >
              <Search className="h-4 w-4 text-[#2563EB]" />
              <span className="hidden sm:inline">Search projects…</span>
              <kbd className="text-[12px] font-medium bg-[#FFFFFF] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0] shadow-2xs">
                ⌘K
              </kbd>
            </button>

            {/* Watchlist Trigger */}
            <button
              onClick={() => setOpenWatchlist(true)}
              className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-[13px] font-medium ${
                watchedItems.length > 0
                  ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                  : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
              title="View Pinned Watchlist"
            >
              <Star className={`h-4 w-4 ${watchedItems.length > 0 ? 'fill-[#F59E0B] text-[#F59E0B]' : ''}`} />
              <span className="hidden md:inline font-semibold">{watchedItems.length}</span>
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpenAlerts(!openAlerts)}
                aria-label="Early-warning notifications"
                className={`relative p-2 rounded-xl border transition ${
                  openAlerts
                    ? 'bg-[#F1F5F9] border-[#CBD5E1] text-[#0F172A]'
                    : 'border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#DC2626] text-white font-medium text-[11px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown (#FFFFFF background, subtle left border) */}
              {openAlerts && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#DC2626]" />
                      <h3 className="font-semibold text-[14px] text-[#0F172A] uppercase tracking-wider">
                        Early-Warning Alerts (Top 5)
                      </h3>
                    </div>
                    <button
                      onClick={() => setOpenAlerts(false)}
                      className="text-[#64748B] hover:text-[#0F172A] text-sm p-1 rounded-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto divide-y divide-[#E2E8F0]">
                    {alerts.length > 0 ? (
                      alerts.map((alert, index) => {
                        const isHigh = alert.severity?.toLowerCase() === 'high' || alert.severity?.toLowerCase() === 'critical'
                        const isMedium = alert.severity?.toLowerCase() === 'medium'

                        return (
                          <div
                            key={alert.id || index}
                            onClick={() => handleAlertClick(alert)}
                            className="p-3.5 hover:bg-[#F8FAFC] cursor-pointer transition flex items-start gap-3 group border-l-3 border-l-transparent hover:border-l-[#2563EB]"
                          >
                            <span className="text-base shrink-0 mt-0.5">
                              {isHigh ? '🔴' : isMedium ? '🟡' : '🔵'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[12px] font-semibold uppercase tracking-wider ${
                                  isHigh ? 'text-[#B91C1C]' : isMedium ? 'text-[#B45309]' : 'text-[#1D4ED8]'
                                }`}>
                                  {alert.severity}
                                </span>
                                {alert.date && (
                                  <span className="text-[12px] text-[#94A3B8] font-normal">{alert.date}</span>
                                )}
                              </div>
                              <p className="text-[14px] font-semibold text-[#0F172A] mt-0.5 line-clamp-1 group-hover:text-[#2563EB]">
                                {alert.title}
                              </p>
                              {alert.project_name && (
                                <p className="text-[13px] text-[#475569] font-normal line-clamp-1 mt-0.5">
                                  {alert.project_name}
                                </p>
                              )}
                              <p className="text-[13px] text-[#64748B] font-normal mt-1 leading-snug">
                                {alert.message}
                              </p>
                              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#EDF2F7] text-[12px]">
                                <span className="text-[#64748B]">
                                  {alert.metric_responsible}: <strong className="text-[#0F172A]">{alert.metric_value}</strong>
                                </span>
                                {alert.project_id && (
                                  <span className="text-[#2563EB] font-medium flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                                    View <ExternalLink className="h-2.5 w-2.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-6 text-center text-[13px] text-[#64748B]">
                        No active early-warning alerts.
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[12px] text-[#64748B] text-center font-normal">
                    MoSPI Real-Time Central Monitor
                  </div>
                </div>
              )}
            </div>

            {/* Officer Profile Badge */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center font-semibold text-[13px]">
                IP
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[14px] font-semibold text-[#0F172A] leading-tight">IPMD Officer</p>
                <p className="text-[12px] text-[#64748B] font-normal">Admin Console</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Viewport (#F8FAFC Application Background) */}
        <main className="flex-1 overflow-auto bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={openSearch} onClose={() => setOpenSearch(false)} />

      {/* Watchlist Drawer */}
      <WatchlistDrawer isOpen={openWatchlist} onClose={() => setOpenWatchlist(false)} />
    </div>
  )
}
