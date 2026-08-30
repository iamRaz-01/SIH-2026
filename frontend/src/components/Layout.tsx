import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  AlertTriangle,
  Network,
  Bell,
  Brain,
  Activity,
  ShieldCheck,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects' },
  { to: '/predict',   icon: Brain,            label: 'Risk Predictor' },
  { to: '/anomalies', icon: AlertTriangle,    label: 'Anomalies' },
  { to: '/network',   icon: Network,          label: 'Project Network' },
  { to: '/alerts',    icon: Bell,             label: 'Alerts' },
  { to: '/health',    icon: Activity,         label: 'System Health' },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-brand-400" />
            <div>
              <p className="font-bold text-gray-100 text-sm leading-tight">InfraGuard AI</p>
              <p className="text-xs text-gray-500">PAIMANA Risk Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'nav-link-active' : 'nav-link'
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-[11px] text-gray-600">SIH26103 · MoSPI · IPMD</p>
          <p className="text-[11px] text-gray-600">
            LightGBM · ROC-AUC 0.797
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
