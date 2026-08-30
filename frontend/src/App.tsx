import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import AnomaliesPage from './pages/AnomaliesPage'
import NetworkPage from './pages/NetworkPage'
import PredictPage from './pages/PredictPage'
import RiskIntelligencePage from './pages/RiskIntelligencePage'
import HealthPage from './pages/HealthPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="risk" element={<RiskIntelligencePage />} />
        <Route path="predict" element={<PredictPage />} />
        <Route path="anomalies" element={<AnomaliesPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="alerts" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
