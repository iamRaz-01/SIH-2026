import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getNetwork, type NetworkResponse, type NetworkNode, type NetworkEdge } from '../api/client'
import {
  Share2, Search, RotateCcw, ZoomIn, ZoomOut,
  ExternalLink, Layers,
} from 'lucide-react'

// Obsidian aesthetic palette
const NODE_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
  Anomaly: '#ec4899',
}

interface SimNode extends NetworkNode {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

interface SimEdge {
  source: SimNode
  target: SimNode
  weight: number
  reasons: string[]
}

export default function NetworkPage() {
  const [data, setData] = useState<NetworkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Interaction States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRisk, setSelectedRisk] = useState<string>('')
  const [selectedState, setSelectedState] = useState<string>('')
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false)
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Camera transform state: pan (offset) and zoom (scale)
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const isDraggingCanvasRef = useRef(false)
  const draggedNodeRef = useRef<SimNode | null>(null)
  const lastMousePosRef = useRef({ x: 0, y: 0 })

  // Simulation nodes and edges state
  const nodesRef = useRef<SimNode[]>([])
  const edgesRef = useRef<SimEdge[]>([])

  // Load genuine network data
  useEffect(() => {
    setLoading(true)
    getNetwork(200)
      .then(res => {
        setData(res)
        initSimulation(res.nodes, res.edges)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // Initialize Force Simulation positions and links
  const initSimulation = (rawNodes: NetworkNode[], rawEdges: NetworkEdge[]) => {
    const width = 1200
    const height = 800

    // Initialize node coordinates with organic radial distribution
    const simNodes: SimNode[] = rawNodes.map((n, i) => {
      const angle = (i / Math.max(rawNodes.length, 1)) * 2 * Math.PI
      const radius = 100 + Math.sqrt(i) * 28 + (i % 5) * 20
      const baseR = n.is_anomaly ? 8 : (n.risk_class === 'High' ? 7.5 : 5.5)

      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: baseR,
      }
    })

    const nodeMap = new Map<string, SimNode>()
    simNodes.forEach(n => nodeMap.set(n.id, n))

    const simEdges: SimEdge[] = []
    rawEdges.forEach(e => {
      const srcId = typeof e.source === 'string' ? e.source : e.source?.id
      const tgtId = typeof e.target === 'string' ? e.target : e.target?.id
      const s = nodeMap.get(srcId)
      const t = nodeMap.get(tgtId)
      if (s && t) {
        simEdges.push({
          source: s,
          target: t,
          weight: e.weight,
          reasons: e.reasons || [],
        })
      }
    })

    nodesRef.current = simNodes
    edgesRef.current = simEdges

    // Center camera on graph
    transformRef.current = { x: 0, y: 0, k: 0.85 }
  }

  // Filter criteria helper
  const isNodeVisible = useCallback((node: SimNode) => {
    if (onlyAnomalies && !node.is_anomaly) return false
    if (selectedRisk && node.risk_class.toUpperCase() !== selectedRisk.toUpperCase()) return false
    if (selectedState && node.state.toUpperCase() !== selectedState.toUpperCase()) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = (node.project_name || node.label || '').toLowerCase().includes(q)
      const matchCode = (node.project_code || node.id || '').toLowerCase().includes(q)
      const matchAgency = (node.agency || '').toLowerCase().includes(q)
      const matchState = (node.state || '').toLowerCase().includes(q)
      if (!matchName && !matchCode && !matchAgency && !matchState) return false
    }
    return true
  }, [onlyAnomalies, selectedRisk, selectedState, searchQuery])

  // Get connected node IDs for highlighting
  const connectedNodeIds = useMemo(() => {
    const target = hoveredNode || selectedNode
    if (!target) return new Set<string>()
    const set = new Set<string>()
    set.add(target.id)
    edgesRef.current.forEach(e => {
      if (e.source.id === target.id) set.add(e.target.id)
      if (e.target.id === target.id) set.add(e.source.id)
    })
    return set
  }, [hoveredNode, selectedNode])

  // Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isRunning = true

    const render = () => {
      if (!isRunning) return

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const transform = transformRef.current

      // ── Physics Step (Force Simulation) ──
      const kRepulsion = 1200
      const kSpring = 0.008
      const damping = 0.88
      const centerStrength = 0.002
      const cx = width / 2
      const cy = height / 2

      // 1. Node Repulsion
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j]
          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const distSq = dx * dx + dy * dy + 0.1
          const dist = Math.sqrt(distSq)

          if (dist < 350) {
            const force = kRepulsion / distSq
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            n1.vx -= fx
            n1.vy -= fy
            n2.vx += fx
            n2.vy += fy
          }
        }

        // Center gravity
        n1.vx += (cx - n1.x) * centerStrength
        n1.vy += (cy - n1.y) * centerStrength
      }

      // 2. Edge Spring Attraction
      for (const e of edges) {
        const s = e.source
        const t = e.target
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const targetDist = 90 / Math.max(e.weight, 0.5)
        const force = (dist - targetDist) * kSpring * e.weight
        const fx = (dx / (dist || 1)) * force
        const fy = (dy / (dist || 1)) * force

        s.vx += fx
        s.vy += fy
        t.vx -= fx
        t.vy -= fy
      }

      // 3. Apply Velocity
      for (const n of nodes) {
        if (n === draggedNodeRef.current) {
          n.vx = 0
          n.vy = 0
          continue
        }
        n.vx *= damping
        n.vy *= damping
        n.x += n.vx
        n.y += n.vy
      }

      // ── Draw Scene (Obsidian Graph Aesthetic) ──
      ctx.clearRect(0, 0, width, height)

      // Background
      ctx.fillStyle = '#070B13'
      ctx.fillRect(0, 0, width, height)

      // Background grid dots
      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.k, transform.k)

      // Draw Edges
      for (const e of edges) {
        const s = e.source
        const t = e.target
        const isSVis = isNodeVisible(s)
        const isTVis = isNodeVisible(t)
        if (!isSVis && !isTVis) continue

        const isHighlighted =
          connectedNodeIds.has(s.id) && connectedNodeIds.has(t.id)

        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)

        if (isHighlighted) {
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.75)'
          ctx.lineWidth = 2 / transform.k
        } else {
          ctx.strokeStyle = 'rgba(75, 85, 99, 0.22)'
          ctx.lineWidth = 1 / transform.k
        }
        ctx.stroke()
      }

      // Draw Nodes
      for (const n of nodes) {
        const isVisible = isNodeVisible(n)
        const isSelected = selectedNode?.id === n.id
        const isHovered = hoveredNode?.id === n.id
        const isConnected = connectedNodeIds.has(n.id)

        let fill = NODE_COLORS[n.risk_class] || '#10b981'
        if (n.is_anomaly) fill = NODE_COLORS.Anomaly

        let radius = n.radius
        if (isSelected || isHovered) radius *= 1.5
        else if (isConnected) radius *= 1.25

        const alpha = isVisible ? (connectedNodeIds.size === 0 || isConnected ? 1 : 0.25) : 0.1

        // Outer glow
        if ((isSelected || isHovered || isConnected) && isVisible) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, radius + 5, 0, Math.PI * 2)
          ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.15)'
          ctx.fill()
        }

        // Main Node Circle
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2)
        ctx.globalAlpha = alpha
        ctx.fillStyle = fill
        ctx.fill()

        // Border ring
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'
        ctx.lineWidth = (isSelected ? 2.5 : 1) / transform.k
        ctx.stroke()
        ctx.globalAlpha = 1.0

        // Labels for highlighted or searched nodes
        if ((isSelected || isHovered || isConnected || (searchQuery && isVisible)) && isVisible) {
          ctx.font = `${Math.max(10, Math.round(11 / transform.k))}px sans-serif`
          ctx.fillStyle = '#f3f4f6'
          ctx.textAlign = 'center'
          ctx.fillText(n.label, n.x, n.y + radius + 12 / transform.k)
        }
      }

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      isRunning = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isNodeVisible, connectedNodeIds, selectedNode, hoveredNode, searchQuery])

  // Mouse / Touch Event Handlers for Canvas
  const screenToWorld = (screenX: number, screenY: number) => {
    const t = transformRef.current
    return {
      x: (screenX - t.x) / t.k,
      y: (screenY - t.y) / t.k,
    }
  }

  const findNodeAtScreenPos = (screenX: number, screenY: number): SimNode | null => {
    const world = screenToWorld(screenX, screenY)
    const nodes = nodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      if (!isNodeVisible(n)) continue
      const dx = n.x - world.x
      const dy = n.y - world.y
      const hitRadius = (n.radius + 6) / transformRef.current.k
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return n
      }
    }
    return null
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const hit = findNodeAtScreenPos(sx, sy)
    if (hit) {
      draggedNodeRef.current = hit
      setSelectedNode(hit)
    } else {
      isDraggingCanvasRef.current = true
      lastMousePosRef.current = { x: sx, y: sy }
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    // Dragging a node
    if (draggedNodeRef.current) {
      const world = screenToWorld(sx, sy)
      draggedNodeRef.current.x = world.x
      draggedNodeRef.current.y = world.y
      return
    }

    // Panning canvas
    if (isDraggingCanvasRef.current) {
      const dx = sx - lastMousePosRef.current.x
      const dy = sy - lastMousePosRef.current.y
      transformRef.current.x += dx
      transformRef.current.y += dy
      lastMousePosRef.current = { x: sx, y: sy }
      return
    }

    // Hover detection
    const hit = findNodeAtScreenPos(sx, sy)
    if (hit !== hoveredNode) {
      setHoveredNode(hit)
      if (hit) {
        setTooltipPos({ x: e.clientX, y: e.clientY })
      } else {
        setTooltipPos(null)
      }
    } else if (hit) {
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }

  const onMouseUp = () => {
    draggedNodeRef.current = null
    isDraggingCanvasRef.current = false
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
    const newK = Math.max(0.2, Math.min(3.5, transformRef.current.k * zoomFactor))

    // Zoom towards mouse pointer
    transformRef.current.x = sx - (sx - transformRef.current.x) * (newK / transformRef.current.k)
    transformRef.current.y = sy - (sy - transformRef.current.y) * (newK / transformRef.current.k)
    transformRef.current.k = newK
  }

  // Zoom Controls
  const zoomIn = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    const newK = Math.min(3.5, transformRef.current.k * 1.25)
    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / transformRef.current.k)
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / transformRef.current.k)
    transformRef.current.k = newK
  }

  const zoomOut = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    const newK = Math.max(0.2, transformRef.current.k * 0.8)
    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / transformRef.current.k)
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / transformRef.current.k)
    transformRef.current.k = newK
  }

  const resetView = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    transformRef.current = { x: 0, y: 0, k: 0.85 }
    setSelectedNode(null)
  }

  // Unique list of states and agencies for filter dropdowns
  const availableStates = useMemo(() => {
    const set = new Set<string>()
    data?.nodes.forEach(n => { if (n.state) set.add(n.state) })
    return Array.from(set).sort()
  }, [data])

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Header (Professional title, Zero USP text) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <Share2 className="h-6 w-6 text-brand-400" />
            Project Network
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Interactive knowledge graph of infrastructure dependencies, implementing agency clusters, and shared geographic corridors
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 bg-gray-900/80 px-3.5 py-2 rounded-xl border border-gray-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-gray-300 font-medium">High Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-gray-300 font-medium">Medium Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-gray-300 font-medium">Low Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            <span className="text-gray-300 font-medium">Anomaly</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/70 p-3 rounded-2xl border border-gray-800/80 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              className="input w-full pl-9 text-xs"
              placeholder="Search project node, code, state…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input text-xs"
            value={selectedRisk}
            onChange={e => setSelectedRisk(e.target.value)}
          >
            <option value="">All Risk Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>

          <select
            className="input text-xs max-w-[160px]"
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
          >
            <option value="">All States</option>
            {availableStates.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              className="rounded bg-gray-800 border-gray-700 text-pink-500 focus:ring-0"
              checked={onlyAnomalies}
              onChange={e => setOnlyAnomalies(e.target.checked)}
            />
            Anomalies Only
          </label>
        </div>

        {/* Zoom & Reset Toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={zoomIn}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition flex items-center gap-1 text-xs"
            title="Reset / Fit View"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Interactive Graph Canvas & Side Drawer */}
      <div className="flex-1 min-h-0 relative rounded-2xl border border-gray-800/80 overflow-hidden bg-[#070B13] shadow-2xl">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-20">
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <div className="animate-spin h-5 w-5 border-2 border-brand-500 border-t-transparent rounded-full" />
              Synthesizing genuine project network graph…
            </div>
          </div>
        )}

        {/* Canvas Element */}
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* Floating Hover Tooltip (All 8 Required Fields) */}
        {hoveredNode && tooltipPos && (
          <div
            className="fixed pointer-events-none z-50 bg-gray-900/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl text-xs text-gray-100 max-w-xs space-y-1.5 backdrop-blur-md"
            style={{
              left: `${Math.min(tooltipPos.x + 15, window.innerWidth - 320)}px`,
              top: `${Math.min(tooltipPos.y + 15, window.innerHeight - 240)}px`,
            }}
          >
            <p className="font-bold text-gray-100 text-sm leading-snug">{hoveredNode.project_name || hoveredNode.label}</p>
            <p className="text-gray-400 font-mono text-[11px]">Code: <strong className="text-gray-200">{hoveredNode.project_code || hoveredNode.id}</strong></p>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px] border-t border-gray-800">
              <div><span className="text-gray-500">Agency:</span> <span className="text-gray-300 truncate block">{hoveredNode.agency}</span></div>
              <div><span className="text-gray-500">State:</span> <span className="text-gray-300 block">{hoveredNode.state}</span></div>
              <div>
                <span className="text-gray-500">Risk:</span>{' '}
                <span className={`font-semibold ${hoveredNode.risk_class === 'High' ? 'text-red-400' : hoveredNode.risk_class === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {hoveredNode.risk_class} Risk
                </span>
              </div>
              <div>
                <span className="text-gray-500">Anomaly:</span>{' '}
                <span className={`font-semibold ${hoveredNode.is_anomaly ? 'text-pink-400' : 'text-gray-300'}`}>
                  {hoveredNode.anomaly_status || (hoveredNode.is_anomaly ? 'ANOMALOUS' : 'NORMAL')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Cost Overrun:</span>{' '}
                <span className="text-gray-200 font-semibold">
                  {hoveredNode.cost_overrun_pct != null ? `${hoveredNode.cost_overrun_pct}%` : 'Data unavailable'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Time Overrun:</span>{' '}
                <span className="text-gray-200 font-semibold">
                  {hoveredNode.time_overrun_pct != null ? `${hoveredNode.time_overrun_pct}%` : hoveredNode.time_overrun_months != null ? `${hoveredNode.time_overrun_months} Mo` : 'Data unavailable'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Selected Node Inspector Drawer (Right Panel) */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 sm:w-96 bg-gray-900/95 border border-gray-700/80 rounded-2xl p-5 shadow-2xl z-30 backdrop-blur-md space-y-4 animate-in fade-in slide-in-from-right-4 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedNode.risk_class === 'High' ? 'bg-red-950 text-red-300 border border-red-800' :
                  selectedNode.risk_class === 'Medium' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {selectedNode.risk_class} Risk
                </span>
                {selectedNode.is_anomaly ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-800 ml-1.5">
                    Anomaly Flagged
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-bold text-gray-100 text-sm leading-snug">{selectedNode.project_name || selectedNode.label}</h3>
              <p className="text-xs text-gray-400 mt-1 font-mono">Code: {selectedNode.project_code || selectedNode.id}</p>
              <p className="text-xs text-gray-400">{selectedNode.agency} · {selectedNode.state}</p>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-950/70 p-3 rounded-xl border border-gray-800">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Original Cost</p>
                <p className="font-semibold text-gray-200 mt-0.5">
                  {selectedNode.original_cost != null ? `₹${selectedNode.original_cost} Cr` : 'Data unavailable'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Revised Cost</p>
                <p className="font-semibold text-gray-200 mt-0.5">
                  {selectedNode.revised_cost != null ? `₹${selectedNode.revised_cost} Cr` : 'Data unavailable'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Cost Overrun</p>
                <p className="font-semibold text-gray-200 mt-0.5">
                  {selectedNode.cost_overrun_pct != null ? `${selectedNode.cost_overrun_pct}%` : 'Data unavailable'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Time Overrun</p>
                <p className="font-semibold text-gray-200 mt-0.5">
                  {selectedNode.time_overrun_pct != null ? `${selectedNode.time_overrun_pct}%` : selectedNode.time_overrun_months != null ? `${selectedNode.time_overrun_months} Mo` : 'Data unavailable'}
                </p>
              </div>
            </div>

            {/* Connected Relationship Links */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-brand-400" />
                Network Connectivity ({selectedNode.degree} Edges)
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-gray-300">
                {edgesRef.current
                  .filter(e => e.source.id === selectedNode.id || e.target.id === selectedNode.id)
                  .map((e, idx) => {
                    const other = e.source.id === selectedNode.id ? e.target : e.source
                    return (
                      <div key={idx} className="bg-gray-800/40 p-2 rounded-lg border border-gray-800 flex items-center justify-between gap-2">
                        <span className="truncate flex-1 text-[11px]">{other.label}</span>
                        <div className="flex gap-1 shrink-0">
                          {e.reasons.map(r => (
                            <span key={r} className="text-[9px] bg-gray-900 text-gray-400 px-1 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            <Link
              to={`/projects/${selectedNode.id}`}
              className="btn-primary w-full text-center text-xs py-2.5 flex items-center justify-center gap-1.5"
            >
              Open Full Project Intelligence <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
