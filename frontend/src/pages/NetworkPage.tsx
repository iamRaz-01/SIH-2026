import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getNetwork, type NetworkResponse, type NetworkNode } from '../api/client'
import {
  Share2, Search, RotateCcw, ZoomIn, ZoomOut,
  ExternalLink, Info, Target, ArrowRight,
} from 'lucide-react'

// Institutional Semantic Colors
const RISK_COLORS: Record<string, string> = {
  High: '#DC2626',
  Medium: '#F59E0B',
  Low: '#16A34A',
}

interface LocalNode extends NetworkNode {
  x: number
  y: number
  isCenter: boolean
  radius: number
}

interface LocalEdge {
  sourceId: string
  targetId: string
  source: LocalNode
  target: LocalNode
  weight: number
  reasons: string[]
  isStrong: boolean
}

export default function NetworkPage() {
  const [data, setData] = useState<NetworkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selected Central Project State
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null)
  const [inspectedNode, setInspectedNode] = useState<LocalNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<LocalNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('')
  const [filterState, setFilterState] = useState<string>('')
  const [filterOnlyAnomalies, setFilterOnlyAnomalies] = useState<boolean>(false)
  const [searchResultsOpen, setSearchResultsOpen] = useState(false)

  // Canvas & Interaction Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const transformRef = useRef({ x: 0, y: 0, k: 1.0 })
  const isDraggingCanvasRef = useRef(false)
  const draggedNodeRef = useRef<LocalNode | null>(null)
  const lastMousePosRef = useRef({ x: 0, y: 0 })

  // Static Local Graph State
  const localNodesRef = useRef<LocalNode[]>([])
  const localEdgesRef = useRef<LocalEdge[]>([])

  // Load genuine project network dataset
  useEffect(() => {
    setLoading(true)
    getNetwork(250)
      .then(res => {
        setData(res)
        if (res.nodes && res.nodes.length > 0) {
          // Select default hub or high-risk project
          const defaultCenter =
            res.nodes.find(n => n.risk_class === 'High' && n.is_anomaly) ||
            res.nodes.find(n => n.degree > 3) ||
            res.nodes[0]
          setSelectedCenterId(defaultCenter.id)
        }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // Build Selective Local Network (5–12 nodes around selected center)
  const buildLocalNetwork = useCallback((centerId: string, fullData: NetworkResponse) => {
    const centerRaw = fullData.nodes.find(n => n.id === centerId)
    if (!centerRaw) return

    // Find candidates connected directly or by strong shared attributes
    const candidateScores = new Map<string, { node: NetworkNode; score: number; reasons: string[] }>()

    // Step 1: Evaluate from existing pre-calculated edges
    fullData.edges.forEach(e => {
      const srcId = typeof e.source === 'string' ? e.source : e.source.id
      const tgtId = typeof e.target === 'string' ? e.target : e.target.id

      if (srcId === centerId || tgtId === centerId) {
        const otherId = srcId === centerId ? tgtId : srcId
        const otherNode = fullData.nodes.find(n => n.id === otherId)
        if (otherNode) {
          candidateScores.set(otherId, {
            node: otherNode,
            score: e.weight || 1.0,
            reasons: e.reasons || ['Shared Agency'],
          })
        }
      }
    })

    // Step 2: Evaluate attribute-based connections with all nodes if edge list is sparse
    fullData.nodes.forEach(other => {
      if (other.id === centerId) return
      if (candidateScores.has(other.id)) return

      const reasons: string[] = []
      let weight = 0

      if (other.agency && centerRaw.agency && other.agency === centerRaw.agency) {
        reasons.push('Shared Agency')
        weight += 1.0
      }
      if (other.state && centerRaw.state && other.state === centerRaw.state) {
        reasons.push('Same State')
        weight += 0.8
      }
      if (
        other.original_cost && centerRaw.original_cost &&
        other.original_cost > 0 && centerRaw.original_cost > 0
      ) {
        const ratio = Math.min(other.original_cost, centerRaw.original_cost) / Math.max(other.original_cost, centerRaw.original_cost)
        if (ratio >= 0.75) {
          reasons.push('Similar Project Scale')
          weight += 0.5
        }
      }

      // Keep only meaningful relationships
      if (reasons.length >= 2 || (reasons.includes('Shared Agency') && weight >= 1.0)) {
        candidateScores.set(other.id, {
          node: other,
          score: weight,
          reasons,
        })
      }
    })

    // Step 3: Filter candidates by user filters
    let candidates = Array.from(candidateScores.values()).filter(c => {
      if (filterRisk && c.node.risk_class.toUpperCase() !== filterRisk.toUpperCase()) return false
      if (filterState && c.node.state.toUpperCase() !== filterState.toUpperCase()) return false
      if (filterOnlyAnomalies && !c.node.is_anomaly) return false
      return true
    })

    // Step 4: Prioritize and prune to top 6–10 related projects
    candidates.sort((a, b) => {
      // Prioritize high relationship score first, then risk/anomaly significance
      if (b.score !== a.score) return b.score - a.score
      const aRiskWeight = a.node.risk_class === 'High' ? 3 : a.node.risk_class === 'Medium' ? 2 : 1
      const bRiskWeight = b.node.risk_class === 'High' ? 3 : b.node.risk_class === 'Medium' ? 2 : 1
      return bRiskWeight - aRiskWeight
    })

    const selectedCandidates = candidates.slice(0, 9) // Max 9 neighbors = max 10 nodes total (within 5–12 target)

    // Step 5: Deterministic Layout Coordinates (Radial Orbit around Center)
    const width = 1200
    const height = 800
    const cx = width / 2
    const cy = height / 2

    const localNodes: LocalNode[] = []

    // Center Node (Dominant size)
    const centerNode: LocalNode = {
      ...centerRaw,
      x: cx,
      y: cy,
      isCenter: true,
      radius: 22,
    }
    localNodes.push(centerNode)

    // Neighbor Nodes
    const numNeighbors = selectedCandidates.length
    selectedCandidates.forEach((c, idx) => {
      const angle = (idx / Math.max(numNeighbors, 1)) * 2 * Math.PI - Math.PI / 2
      // Stagger radius slightly to avoid label collisions (200px / 260px alternating)
      const dist = 210 + (idx % 2) * 55

      const isHigh = c.node.risk_class === 'High'
      const isAnom = Boolean(c.node.is_anomaly)
      const baseR = isHigh ? 16 : isAnom ? 15 : 13

      localNodes.push({
        ...c.node,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        isCenter: false,
        radius: baseR,
      })
    })

    // Step 6: Build Pruned Local Edges
    const localNodeMap = new Map<string, LocalNode>()
    localNodes.forEach(n => localNodeMap.set(n.id, n))

    const localEdges: LocalEdge[] = []

    // Connect Center Node to all neighbors
    selectedCandidates.forEach(c => {
      const neighbor = localNodeMap.get(c.node.id)
      if (neighbor) {
        localEdges.push({
          sourceId: centerNode.id,
          targetId: neighbor.id,
          source: centerNode,
          target: neighbor,
          weight: c.score,
          reasons: c.reasons,
          isStrong: c.score >= 1.5,
        })
      }
    })

    // Connect Inter-neighbor strong connections (Limit max 2 additional edges per node to avoid hairball)
    for (let i = 1; i < localNodes.length; i++) {
      for (let j = i + 1; j < localNodes.length; j++) {
        const nA = localNodes[i]
        const nB = localNodes[j]

        // Check if shared agency + state
        if (nA.agency && nB.agency && nA.agency === nB.agency && nA.state && nB.state && nA.state === nB.state) {
          localEdges.push({
            sourceId: nA.id,
            targetId: nB.id,
            source: nA,
            target: nB,
            weight: 1.8,
            reasons: ['Shared Agency + State'],
            isStrong: true,
          })
        }
      }
    }

    // Step 7: Rapid deterministic 40-step convergence to relax any edge overlap, then FREEZE
    for (let iter = 0; iter < 40; iter++) {
      for (let i = 1; i < localNodes.length; i++) {
        const n1 = localNodes[i]
        for (let j = i + 1; j < localNodes.length; j++) {
          const n2 = localNodes[j]
          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          if (d < 120) {
            const push = (120 - d) * 0.1
            n1.x -= (dx / d) * push
            n1.y -= (dy / d) * push
            n2.x += (dx / d) * push
            n2.y += (dy / d) * push
          }
        }
      }
    }

    // Save frozen positions
    localNodesRef.current = localNodes
    localEdgesRef.current = localEdges
    setInspectedNode(centerNode)

    // Center view transform
    transformRef.current = { x: 0, y: 0, k: 1.0 }
  }, [filterRisk, filterState, filterOnlyAnomalies])

  // Rebuild graph when center or data changes
  useEffect(() => {
    if (selectedCenterId && data) {
      buildLocalNetwork(selectedCenterId, data)
    }
  }, [selectedCenterId, data, buildLocalNetwork])

  // Static Canvas Render Loop (Zero physics, zero drift)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isRendering = true

    const render = () => {
      if (!isRendering) return

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const nodes = localNodesRef.current
      const edges = localEdgesRef.current
      const transform = transformRef.current

      // Clear & Background
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#F8FAFC'
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.k, transform.k)

      // Draw Edges (Subtle lines, solid for strong, dashed for moderate)
      for (const e of edges) {
        const isHovered = hoveredNode && (e.source.id === hoveredNode.id || e.target.id === hoveredNode.id)
        const isInspected = inspectedNode && (e.source.id === inspectedNode.id || e.target.id === inspectedNode.id)

        ctx.beginPath()
        ctx.moveTo(e.source.x, e.source.y)
        ctx.lineTo(e.target.x, e.target.y)

        if (isHovered || isInspected) {
          ctx.setLineDash([])
          ctx.strokeStyle = '#2563EB'
          ctx.lineWidth = 2.0 / transform.k
        } else if (e.isStrong) {
          ctx.setLineDash([])
          ctx.strokeStyle = '#CBD5E1'
          ctx.lineWidth = 1.4 / transform.k
        } else {
          ctx.setLineDash([4 / transform.k, 4 / transform.k])
          ctx.strokeStyle = '#E2E8F0'
          ctx.lineWidth = 1.0 / transform.k
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw Nodes
      for (const n of nodes) {
        const isCenter = n.isCenter
        const isInspected = inspectedNode?.id === n.id
        const isHovered = hoveredNode?.id === n.id

        const fill = RISK_COLORS[n.risk_class] || '#16A34A'

        // Selection / Center Glow & Outline
        if (isCenter) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 7, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
          ctx.fill()
          ctx.strokeStyle = '#2563EB'
          ctx.lineWidth = 2.0 / transform.k
          ctx.stroke()
        } else if (isInspected || isHovered) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.08)'
          ctx.fill()
          ctx.strokeStyle = '#0F172A'
          ctx.lineWidth = 1.8 / transform.k
          ctx.stroke()
        }

        // Anomaly Status Ring
        if (n.is_anomaly) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 3, 0, Math.PI * 2)
          ctx.strokeStyle = '#7C3AED'
          ctx.lineWidth = 1.5 / transform.k
          ctx.stroke()
        }

        // Node Circle Body
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()

        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2.0 / transform.k
        ctx.stroke()

        // Node Label (Clean readable text pill)
        const labelText = n.label || n.project_name
        const truncatedLabel = labelText.length > 24 ? labelText.slice(0, 24) + '…' : labelText

        ctx.font = `${isCenter ? '700' : '600'} ${Math.max(11, Math.round(13 / transform.k))}px "Inter", sans-serif`
        const textWidth = ctx.measureText(truncatedLabel).width

        // Background pill behind text for maximum legibility
        ctx.fillStyle = isCenter ? '#0F172A' : '#FFFFFF'
        const pillY = n.y + n.radius + 4 / transform.k
        const pillH = 18 / transform.k
        const pillW = textWidth + 12 / transform.k
        const pillX = n.x - pillW / 2

        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillW, pillH, 4 / transform.k)
        ctx.fill()

        if (!isCenter) {
          ctx.strokeStyle = '#E2E8F0'
          ctx.lineWidth = 1 / transform.k
          ctx.stroke()
        }

        // Text
        ctx.fillStyle = isCenter ? '#FFFFFF' : '#0F172A'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(truncatedLabel, n.x, pillY + pillH / 2)
      }

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      isRendering = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [inspectedNode, hoveredNode])

  // Coordinate Conversion
  const screenToWorld = (screenX: number, screenY: number) => {
    const t = transformRef.current
    return {
      x: (screenX - t.x) / t.k,
      y: (screenY - t.y) / t.k,
    }
  }

  const findNodeAtScreen = (screenX: number, screenY: number): LocalNode | null => {
    const world = screenToWorld(screenX, screenY)
    const nodes = localNodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      const dx = n.x - world.x
      const dy = n.y - world.y
      const hitRadius = (n.radius + 8) / transformRef.current.k
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return n
      }
    }
    return null
  }

  // Mouse Handlers (Static exploration + Node Dragging)
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const hit = findNodeAtScreen(sx, sy)
    if (hit) {
      draggedNodeRef.current = hit
      setInspectedNode(hit)
    } else {
      isDraggingCanvasRef.current = true
      lastMousePosRef.current = { x: sx, y: sy }
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (draggedNodeRef.current) {
      const world = screenToWorld(sx, sy)
      // Directly persist position on drag
      draggedNodeRef.current.x = world.x
      draggedNodeRef.current.y = world.y
      return
    }

    if (isDraggingCanvasRef.current) {
      const dx = sx - lastMousePosRef.current.x
      const dy = sy - lastMousePosRef.current.y
      transformRef.current.x += dx
      transformRef.current.y += dy
      lastMousePosRef.current = { x: sx, y: sy }
      return
    }

    const hit = findNodeAtScreen(sx, sy)
    if (hit !== hoveredNode) {
      setHoveredNode(hit)
      setTooltipPos(hit ? { x: e.clientX, y: e.clientY } : null)
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

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newK = Math.max(0.4, Math.min(2.5, transformRef.current.k * zoomFactor))

    transformRef.current.x = sx - (sx - transformRef.current.x) * (newK / transformRef.current.k)
    transformRef.current.y = sy - (sy - transformRef.current.y) * (newK / transformRef.current.k)
    transformRef.current.k = newK
  }

  // Zoom & Reset Handlers
  const zoomIn = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    const newK = Math.min(2.5, transformRef.current.k * 1.2)
    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / transformRef.current.k)
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / transformRef.current.k)
    transformRef.current.k = newK
  }

  const zoomOut = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    const newK = Math.max(0.4, transformRef.current.k * 0.8)
    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / transformRef.current.k)
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / transformRef.current.k)
    transformRef.current.k = newK
  }

  const resetLayout = () => {
    if (selectedCenterId && data) {
      buildLocalNetwork(selectedCenterId, data)
    }
  }

  // Search Results Filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !data) return []
    const q = searchQuery.toLowerCase()
    return data.nodes.filter(n =>
      (n.project_name || '').toLowerCase().includes(q) ||
      (n.project_code || '').toLowerCase().includes(q) ||
      (n.agency || '').toLowerCase().includes(q) ||
      (n.state || '').toLowerCase().includes(q)
    ).slice(0, 6)
  }, [searchQuery, data])

  const handleSelectSearchProject = (nodeId: string) => {
    setSelectedCenterId(nodeId)
    setSearchQuery('')
    setSearchResultsOpen(false)
  }

  // Dynamic Network Insights Calculation
  const networkInsights = useMemo(() => {
    const nodes = localNodesRef.current
    const edges = localEdgesRef.current
    const center = nodes.find(n => n.isCenter)

    if (!center) return null

    const neighbors = nodes.filter(n => !n.isCenter)
    const highRiskCount = neighbors.filter(n => n.risk_class === 'High').length
    const anomalousCount = neighbors.filter(n => n.is_anomaly).length

    // Strongest relationship
    const sortedEdges = [...edges].sort((a, b) => b.weight - a.weight)
    const topReason = sortedEdges[0]?.reasons?.join(' + ') || 'Shared Agency'

    return {
      centerName: center.project_name,
      centerCode: center.project_code || center.id,
      connectedCount: neighbors.length,
      highRiskCount,
      anomalousCount,
      strongestRelationship: topReason,
    }
  }, [selectedCenterId, localNodesRef.current])

  // Distinct states for filter
  const availableStates = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.nodes.forEach(n => { if (n.state) set.add(n.state) })
    return Array.from(set).sort()
  }, [data])

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-4.5rem)] bg-[#F8FAFC]">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#2563EB]">Selective Knowledge Graph</span>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mt-0.5 flex items-center gap-2.5">
            <Share2 className="h-6 w-6 text-[#2563EB]" />
            Project Network
          </h1>
          <p className="text-[#475569] text-[14px] font-normal mt-0.5">
            Selective local infrastructure network detailing verified operational relationships across agencies, states, and capital scales
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 bg-[#FFFFFF] px-3.5 py-2 rounded-xl border border-[#E2E8F0] text-[13px] font-medium shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            <span className="text-[#334155]">High Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span className="text-[#334155]">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
            <span className="text-[#334155]">Low Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-[#7C3AED] bg-transparent" />
            <span className="text-[#334155]">Anomaly</span>
          </div>
        </div>
      </div>

      {/* ── Search & Controls Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFFFFF] p-3 rounded-2xl border border-[#E2E8F0] shrink-0 shadow-xs relative z-20">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          {/* Real-time Center Project Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              className="input w-full pl-10 text-[15px] placeholder:text-[15px]"
              placeholder="Search central project by name, code…"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setSearchResultsOpen(true)
              }}
              onFocus={() => setSearchResultsOpen(true)}
            />

            {/* Search Dropdown */}
            {searchResultsOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[#EDF2F7]">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectSearchProject(p.id)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#F8FAFC] transition flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#0F172A] truncate">{p.project_name}</p>
                      <p className="text-[11px] text-[#64748B]">Code: {p.project_code || p.id} · {p.agency}</p>
                    </div>
                    <Target className="h-4 w-4 text-[#2563EB] shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            className="input text-[14px]"
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
          >
            <option value="">All Risk Thresholds</option>
            <option value="High">High Risk Only</option>
            <option value="Medium">Medium Risk Only</option>
            <option value="Low">Low Risk Only</option>
          </select>

          <select
            className="input text-[14px] max-w-[160px]"
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
          >
            <option value="">All States</option>
            {availableStates.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-[13px] text-[#334155] cursor-pointer select-none ml-2 font-medium">
            <input
              type="checkbox"
              className="rounded bg-[#FFFFFF] border-[#CBD5E1] text-[#7C3AED] focus:ring-0"
              checked={filterOnlyAnomalies}
              onChange={e => setFilterOnlyAnomalies(e.target.checked)}
            />
            Anomalous Only
          </label>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={zoomIn}
            className="p-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] transition shadow-2xs"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] transition shadow-2xs"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetLayout}
            className="p-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] transition flex items-center gap-1 text-[13px] font-medium shadow-2xs"
            title="Recalculate and Freeze Layout"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Layout
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 text-[#B91C1C] text-[14px]">
          {error}
        </div>
      )}

      {/* ── Main Layout (Canvas + Network Insight & Details Panels) ── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        {/* Graph Canvas Container */}
        <div className="flex-1 min-h-[400px] relative rounded-2xl border border-[#E2E8F0] overflow-hidden bg-[#FFFFFF] shadow-xs">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-20">
              <div className="flex items-center gap-3 text-[#475569] text-[14px]">
                <div className="animate-spin h-5 w-5 border-2 border-[#2563EB] border-t-transparent rounded-full" />
                Synthesizing selective local project network…
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={onWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing block bg-[#F8FAFC]"
          />

          {/* Hover Tooltip */}
          {hoveredNode && tooltipPos && (
            <div
              className="fixed pointer-events-none z-50 bg-[#FFFFFF] border border-[#CBD5E1] p-3.5 rounded-xl shadow-xl text-[13px] text-[#0F172A] max-w-xs space-y-1"
              style={{
                left: `${Math.min(tooltipPos.x + 15, window.innerWidth - 320)}px`,
                top: `${Math.min(tooltipPos.y + 15, window.innerHeight - 220)}px`,
              }}
            >
              <p className="font-semibold text-[#0F172A] text-[14px] leading-snug">{hoveredNode.project_name}</p>
              <p className="text-[#64748B] text-[12px]">Code: <strong className="text-[#0F172A]">{hoveredNode.project_code || hoveredNode.id}</strong></p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[12px] border-t border-[#EDF2F7]">
                <div><span className="text-[#64748B]">Agency:</span> <span className="text-[#334155] truncate block">{hoveredNode.agency}</span></div>
                <div><span className="text-[#64748B]">State:</span> <span className="text-[#334155] block">{hoveredNode.state}</span></div>
                <div>
                  <span className="text-[#64748B]">Risk:</span>{' '}
                  <span className={`font-semibold ${hoveredNode.risk_class === 'High' ? 'text-[#DC2626]' : hoveredNode.risk_class === 'Medium' ? 'text-[#D97706]' : 'text-[#16A34A]'}`}>
                    {hoveredNode.risk_class} Risk
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">Anomaly:</span>{' '}
                  <span className={`font-semibold ${hoveredNode.is_anomaly ? 'text-[#7C3AED]' : 'text-[#334155]'}`}>
                    {hoveredNode.is_anomaly ? 'Flagged' : 'Normal'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Side Information Panel (Network Insight + Selected Project Details) ── */}
        <div className="w-full lg:w-88 flex flex-col gap-4 shrink-0 overflow-y-auto">
          {/* Dynamic Network Insight Card */}
          {networkInsights && (
            <div className="card p-4.5 space-y-3 bg-[#FFFFFF]">
              <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
                <Info className="h-4.5 w-4.5 text-[#2563EB]" />
                <h3 className="text-[16px] font-semibold text-[#0F172A]">Local Network Insight</h3>
              </div>

              <div className="space-y-2 text-[13px]">
                <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] uppercase font-semibold block">Central Focus Project</span>
                  <p className="font-semibold text-[#0F172A] text-[13px] line-clamp-1 mt-0.5">{networkInsights.centerName}</p>
                  <p className="text-[11px] text-[#64748B]">Code: {networkInsights.centerCode}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E8F0]">
                    <span className="text-[11px] text-[#64748B] block font-medium">Neighbors</span>
                    <p className="font-bold text-[16px] text-[#0F172A] mt-0.5">{networkInsights.connectedCount}</p>
                  </div>
                  <div className="bg-[#FEF2F2] p-2 rounded-lg border border-[#FECACA]">
                    <span className="text-[11px] text-[#B91C1C] block font-medium">High-Risk</span>
                    <p className="font-bold text-[16px] text-[#DC2626] mt-0.5">{networkInsights.highRiskCount}</p>
                  </div>
                  <div className="bg-[#F5F3FF] p-2 rounded-lg border border-[#DDD6FE]">
                    <span className="text-[11px] text-[#6D28D9] block font-medium">Anomalous</span>
                    <p className="font-bold text-[16px] text-[#7C3AED] mt-0.5">{networkInsights.anomalousCount}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#EDF2F7] text-[12px]">
                  <span className="text-[#64748B]">Primary Relationship:</span>
                  <span className="font-semibold text-[#2563EB]">{networkInsights.strongestRelationship}</span>
                </div>
              </div>
            </div>
          )}

          {/* Inspected Node Detail Card */}
          {inspectedNode && (
            <div className="card p-4.5 space-y-3 bg-[#FFFFFF] flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
                    inspectedNode.risk_class === 'High' ? 'badge-danger' :
                    inspectedNode.risk_class === 'Medium' ? 'badge-warning' :
                    'badge-success'
                  }`}>
                    {inspectedNode.risk_class} Risk
                  </span>
                  {inspectedNode.is_anomaly ? (
                    <span className="text-[12px] font-medium px-2.5 py-0.5 rounded-full badge-purple ml-1.5">
                      Anomaly
                    </span>
                  ) : null}
                </div>
                {inspectedNode.id !== selectedCenterId && (
                  <button
                    onClick={() => setSelectedCenterId(inspectedNode.id)}
                    className="text-[12px] text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1"
                    title="Set this project as the graph center"
                  >
                    Make Center <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-[#0F172A] text-[15px] leading-snug">{inspectedNode.project_name}</h4>
                <p className="text-[12px] text-[#64748B] mt-0.5 font-normal">Code: {inspectedNode.project_code || inspectedNode.id}</p>
                <p className="text-[13px] text-[#475569] font-normal">{inspectedNode.agency} · {inspectedNode.state}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <p className="text-[11px] text-[#64748B] uppercase font-semibold">Original Cost</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5">
                    {inspectedNode.original_cost != null ? `₹${inspectedNode.original_cost} Cr` : 'Data unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#2563EB] uppercase font-semibold">Revised Cost</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5">
                    {inspectedNode.revised_cost != null ? `₹${inspectedNode.revised_cost} Cr` : 'Data unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B] uppercase font-semibold">Cost Overrun</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5">
                    {inspectedNode.cost_overrun_pct != null ? `${inspectedNode.cost_overrun_pct}%` : 'Data unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B] uppercase font-semibold">Time Overrun</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5">
                    {inspectedNode.time_overrun_pct != null ? `${inspectedNode.time_overrun_pct}%` : inspectedNode.time_overrun_months != null ? `${inspectedNode.time_overrun_months} Mo` : 'Data unavailable'}
                  </p>
                </div>
              </div>

              <Link
                to={`/projects/${inspectedNode.id}`}
                className="btn-primary w-full text-center text-[13px] font-semibold py-2 flex items-center justify-center gap-1.5"
              >
                Open Project Intelligence <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
