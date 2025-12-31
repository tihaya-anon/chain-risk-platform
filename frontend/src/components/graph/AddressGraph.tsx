import { useEffect, useRef, useCallback } from "react"
import { Network, DataSet, Options } from "vis-network/standalone"
import type { NeighborInfo } from "@/types"

export interface GraphNode {
  id: string
  label: string
  color?:
    | string
    | {
        background: string
        border: string
        highlight?: { background: string; border: string }
      }
  size?: number
  font?: { color: string }
  borderWidth?: number
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  label?: string
  arrows?: string
  color?: string | { color: string; highlight?: string; hover?: string }
  width?: number
  dashes?: boolean
  hoverWidth?: number
}

// Export neighbor info for hover/select panel
export interface HoveredNodeInfo {
  address: string
  riskScore?: number
  tags?: string[]
  transferCount?: number
  direction?: string
  isCenter?: boolean
}

interface AddressGraphProps {
  centerAddress: string
  neighbors: NeighborInfo[]
  selectedNode?: string | null
  onNodeSelect?: (info: HoveredNodeInfo | null) => void
  onNodeHover?: (info: HoveredNodeInfo | null) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
  className?: string
}

// Improved color palette - softer, more professional colors
const COLORS = {
  center: {
    background: "#3B82F6",
    border: "#2563EB",
    highlight: { background: "#60A5FA", border: "#3B82F6" },
  },
  low: {
    background: "#34D399",
    border: "#10B981",
    highlight: { background: "#6EE7B7", border: "#34D399" },
  },
  medium: {
    background: "#FBBF24",
    border: "#F59E0B",
    highlight: { background: "#FCD34D", border: "#FBBF24" },
  },
  high: {
    background: "#FB923C",
    border: "#F97316",
    highlight: { background: "#FDBA74", border: "#FB923C" },
  },
  critical: {
    background: "#F87171",
    border: "#EF4444",
    highlight: { background: "#FCA5A5", border: "#F87171" },
  },
  unknown: {
    background: "#9CA3AF",
    border: "#6B7280",
    highlight: { background: "#D1D5DB", border: "#9CA3AF" },
  },
  edge: {
    incoming: "#10B981",
    outgoing: "#F97316",
    both: "#6B7280",
  },
}

// Risk score to color mapping
function getRiskColors(riskScore: number | undefined) {
  if (riskScore === undefined || riskScore === null) return COLORS.unknown
  if (riskScore >= 0.8) return COLORS.critical
  if (riskScore >= 0.6) return COLORS.high
  if (riskScore >= 0.4) return COLORS.medium
  return COLORS.low
}

// Format address for display
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function AddressGraph({
  centerAddress,
  neighbors,
  selectedNode,
  onNodeSelect,
  onNodeHover,
  onNodeDoubleClick,
  height = "500px",
  className = "",
}: AddressGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const neighborsMapRef = useRef<Map<string, NeighborInfo>>(new Map())

  // Store callbacks in refs to avoid re-creating network on callback changes
  const onNodeHoverRef = useRef(onNodeHover)
  const onNodeSelectRef = useRef(onNodeSelect)
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick)
  const selectedNodeRef = useRef(selectedNode)

  // Update refs when callbacks/props change
  useEffect(() => {
    onNodeHoverRef.current = onNodeHover
    onNodeSelectRef.current = onNodeSelect
    onNodeDoubleClickRef.current = onNodeDoubleClick
    selectedNodeRef.current = selectedNode
  }, [onNodeHover, onNodeSelect, onNodeDoubleClick, selectedNode])

  // Helper to get node info
  const getNodeInfo = useCallback(
    (nodeId: string): HoveredNodeInfo | null => {
      if (nodeId === centerAddress) {
        return { address: centerAddress, isCenter: true }
      }
      const neighbor = neighborsMapRef.current.get(nodeId)
      if (neighbor) {
        return {
          address: neighbor.address,
          riskScore: neighbor.riskScore,
          tags: neighbor.tags,
          transferCount: neighbor.transferCount,
          direction: neighbor.direction,
        }
      }
      return null
    },
    [centerAddress]
  )

  // Build graph data
  const buildGraphData = useCallback(() => {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeSet = new Set<string>()
    const neighborsMap = new Map<string, NeighborInfo>()

    // Add center node
    nodes.push({
      id: centerAddress,
      label: formatAddress(centerAddress),
      color: COLORS.center,
      size: 35,
      font: { color: "#FFFFFF" },
      borderWidth: 3,
    })
    nodeSet.add(centerAddress)

    // Add neighbor nodes and edges
    neighbors.forEach((neighbor, index) => {
      neighborsMap.set(neighbor.address, neighbor)

      if (!nodeSet.has(neighbor.address)) {
        const colors = getRiskColors(neighbor.riskScore)
        nodes.push({
          id: neighbor.address,
          label: formatAddress(neighbor.address),
          color: colors,
          size: Math.min(28, 18 + neighbor.transferCount * 0.3),
          borderWidth: 2,
        })
        nodeSet.add(neighbor.address)
      }

      // Create edge based on direction
      const edgeId = `edge-${index}`
      const edgeWidth = Math.min(4, 1.5 + neighbor.transferCount * 0.15)

      // Edge color - same color for highlight/hover to prevent color change
      const getEdgeColor = (baseColor: string) => ({
        color: baseColor,
        highlight: baseColor,
        hover: baseColor,
      })

      if (neighbor.direction === "incoming") {
        edges.push({
          id: edgeId,
          from: neighbor.address,
          to: centerAddress,
          arrows: "to",
          width: edgeWidth,
          color: getEdgeColor(COLORS.edge.incoming),
        })
      } else if (neighbor.direction === "outgoing") {
        edges.push({
          id: edgeId,
          from: centerAddress,
          to: neighbor.address,
          arrows: "to",
          width: edgeWidth,
          color: getEdgeColor(COLORS.edge.outgoing),
        })
      } else {
        // Both directions
        edges.push({
          id: edgeId,
          from: centerAddress,
          to: neighbor.address,
          arrows: "to;from",
          width: edgeWidth,
          color: getEdgeColor(COLORS.edge.both),
        })
      }
    })

    neighborsMapRef.current = neighborsMap
    return { nodes, edges }
  }, [centerAddress, neighbors])

  // Initialize network
  useEffect(() => {
    if (!containerRef.current) return

    const { nodes, edges } = buildGraphData()

    const nodesDataSet = new DataSet(nodes)
    const edgesDataSet = new DataSet(edges)

    const options: Options = {
      nodes: {
        shape: "dot",
        font: {
          size: 11,
          color: "#374151",
          face: "system-ui, -apple-system, sans-serif",
        },
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.1)",
          size: 8,
          x: 2,
          y: 2,
        },
      },
      edges: {
        smooth: {
          enabled: true,
          type: "continuous",
          roundness: 0.5,
        },
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.05)",
          size: 4,
        },
        hoverWidth: 1.5, // Multiplier for edge width on hover
        selectionWidth: 1.5,
      },
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -60,
          centralGravity: 0.01,
          springLength: 120,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: {
          enabled: true,
          iterations: 100,
          updateInterval: 25,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 0,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true,
        selectConnectedEdges: false,
      },
      layout: {
        improvedLayout: true,
      },
    }

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
      options
    )

    // Hover event - only trigger if no node is selected
    network.on("hoverNode", (params) => {
      // Skip hover if a node is selected
      if (selectedNodeRef.current) return

      const nodeId = params.node as string
      const info = getNodeInfo(nodeId)
      if (info) {
        onNodeHoverRef.current?.(info)
      }
    })

    network.on("blurNode", () => {
      // Clear hover info only if no node is selected
      if (!selectedNodeRef.current) {
        onNodeHoverRef.current?.(null)
      }
    })

    // Click event - toggle selection
    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string

        // If clicking the same node, deselect it
        if (selectedNodeRef.current === nodeId) {
          onNodeSelectRef.current?.(null)
        } else {
          // Select new node
          const info = getNodeInfo(nodeId)
          if (info) {
            onNodeSelectRef.current?.(info)
          }
        }
      } else {
        // Clicked on empty space - deselect
        onNodeSelectRef.current?.(null)
      }
    })

    network.on("doubleClick", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        onNodeDoubleClickRef.current?.(nodeId)
      }
    })

    // Stabilization complete
    network.on("stabilizationIterationsDone", () => {
      network.setOptions({ physics: { enabled: false } })
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [buildGraphData, centerAddress, getNodeInfo])

  return (
    <div className={className}>
      <div
        ref={containerRef}
        style={{ height, width: "100%" }}
        className="border border-gray-200 rounded-lg bg-slate-50"
      />
    </div>
  )
}

// Legend component with updated colors
export function GraphLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: COLORS.center.background,
            border: `2px solid ${COLORS.center.border}`,
          }}
        />
        <span>Center Address</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: COLORS.low.background,
            border: `2px solid ${COLORS.low.border}`,
          }}
        />
        <span>Low Risk (&lt;0.4)</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: COLORS.medium.background,
            border: `2px solid ${COLORS.medium.border}`,
          }}
        />
        <span>Medium Risk (0.4-0.6)</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: COLORS.high.background,
            border: `2px solid ${COLORS.high.border}`,
          }}
        />
        <span>High Risk (0.6-0.8)</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: COLORS.critical.background,
            border: `2px solid ${COLORS.critical.border}`,
          }}
        />
        <span>Critical Risk (&gt;0.8)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5" style={{ backgroundColor: COLORS.edge.incoming }} />
        <span>Incoming</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5" style={{ backgroundColor: COLORS.edge.outgoing }} />
        <span>Outgoing</span>
      </div>
    </div>
  )
}
