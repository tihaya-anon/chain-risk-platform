import { useMemo, useRef } from "react"
import ReactECharts from "echarts-for-react"
import { Circle, ArrowRight, ArrowLeft, ArrowLeftRight } from "lucide-react"
import type { AddressNeighborsResponse, GraphNode, GraphEdge } from "@/api/generated"

interface AddressGraphProps {
  data: AddressNeighborsResponse | null
  selectedNode?: string | null
  onNodeHover?: (node: GraphNode | null, isCenter?: boolean) => void
  onNodeClick?: (node: GraphNode | null, isCenter?: boolean) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
}

interface NodeValue {
  address: string
  riskScore?: number
  tags?: string[]
  distance: number
  isCenter: boolean
}

function getRiskColor(riskScore?: number): string {
  if (riskScore === undefined) return "#6B7280"
  if (riskScore >= 0.8) return "#EF4444"
  if (riskScore >= 0.6) return "#F97316"
  if (riskScore >= 0.4) return "#FBBF24"
  return "#10B981"
}

// Edge direction colors
const EDGE_COLORS = {
  incoming: "#3B82F6",  // blue - money flowing in
  outgoing: "#F97316",  // orange - money flowing out
  both: "#8B5CF6",      // purple - bidirectional
}

/**
 * Calculate radial layout positions for nodes
 */
function calculateRadialLayout(
  centerAddress: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
) {
  const positions = new Map<string, { x: number; y: number }>()
  
  // Group nodes by distance
  const nodesByDistance = new Map<number, GraphNode[]>()
  nodes.forEach((node) => {
    const dist = node.distance ?? (node.address === centerAddress ? 0 : 1)
    if (!nodesByDistance.has(dist)) {
      nodesByDistance.set(dist, [])
    }
    nodesByDistance.get(dist)!.push(node)
  })

  // Center node at origin
  positions.set(centerAddress, { x: 0, y: 0 })

  // Build parent-child relationships for better angle distribution
  const edgeLookup = new Map<string, Set<string>>()
  edges.forEach((e) => {
    if (!edgeLookup.has(e.from)) edgeLookup.set(e.from, new Set())
    if (!edgeLookup.has(e.to)) edgeLookup.set(e.to, new Set())
    edgeLookup.get(e.from)!.add(e.to)
    edgeLookup.get(e.to)!.add(e.from)
  })

  // Place nodes at each distance level
  const baseRadius = 180
  const maxDist = Math.max(...Array.from(nodesByDistance.keys()))

  for (let dist = 1; dist <= maxDist; dist++) {
    const nodesAtDist = nodesByDistance.get(dist) || []
    if (nodesAtDist.length === 0) continue

    const radius = baseRadius * dist
    const angleStep = (2 * Math.PI) / nodesAtDist.length
    const startAngle = -Math.PI / 2 // Start from top

    nodesAtDist.forEach((node, index) => {
      const angle = startAngle + index * angleStep
      positions.set(node.address, {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      })
    })
  }

  return positions
}

/**
 * Determine edge direction relative to center
 */

export function AddressGraph({
  data,
  selectedNode,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  height = "500px",
}: AddressGraphProps) {
  const chartRef = useRef<ReactECharts>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const { graphNodes, graphLinks } = useMemo(() => {
    if (!data?.address || !data.nodes) {
      return { graphNodes: [], graphLinks: [] }
    }

    const centerAddress = data.address
    const positions = calculateRadialLayout(centerAddress, data.nodes, data.edges || [])

    // Build nodes
    const graphNodes = data.nodes.map((node) => {
      const pos = positions.get(node.address) || { x: 0, y: 0 }
      const isCenter = node.address === centerAddress
      const isSelected = selectedNode === node.address

      return {
        id: node.address,
        name: "",
        x: pos.x,
        y: pos.y,
        fixed: true,
        value: {
          address: node.address,
          riskScore: node.riskScore,
          tags: node.tags,
          distance: node.distance ?? (isCenter ? 0 : 1),
          isCenter,
        } as NodeValue,
        symbolSize: isCenter ? 40 : 22 + (node.riskScore || 0) * 12,
        itemStyle: {
          color: isCenter ? "#3B82F6" : getRiskColor(node.riskScore),
          borderColor: isSelected ? "#1F2937" : (isCenter ? "#1D4ED8" : getRiskColor(node.riskScore)),
          borderWidth: isSelected ? 4 : 2,
          shadowBlur: isSelected ? 15 : 0,
          shadowColor: isSelected ? "rgba(0,0,0,0.4)" : "transparent",
        },
      }
    })

    // Build edges - deduplicate and determine direction
    const edgePairs = new Map<string, { from: string; to: string; direction: "incoming" | "outgoing" | "both" }>()
    
    ;(data.edges || []).forEach((edge) => {
      const key = [edge.from, edge.to].sort().join("-")
      const existing = edgePairs.get(key)
      
      if (existing) {
        existing.direction = "both"
      } else {
        edgePairs.set(key, {
          from: edge.from,
          to: edge.to,
          direction: edge.from === centerAddress ? "outgoing" : "incoming",
        })
      }
    })

    const graphLinks = Array.from(edgePairs.values()).map((edge) => ({
      source: edge.from,
      target: edge.to,
      lineStyle: {
        color: EDGE_COLORS[edge.direction],
        width: 2,
        curveness: 0.2,
        opacity: 0.7,
      },
      symbol: edge.direction === "both" ? ["arrow", "arrow"] : ["none", "arrow"],
      symbolSize: [0, 8],
    }))

    return { graphNodes, graphLinks }
  }, [data, selectedNode])

  const option = useMemo(() => {
    if (!graphNodes.length) return {}

    return {
      tooltip: { show: false },
      series: [
        {
          type: "graph" as const,
          layout: "none" as const,
          data: graphNodes,
          links: graphLinks,
          roam: true,
          label: { show: false },
          emphasis: {
            focus: "adjacency" as const,
            itemStyle: {
              borderWidth: 3,
              shadowBlur: 12,
              shadowColor: "rgba(0,0,0,0.3)",
            },
            lineStyle: {
              width: 3,
            },
          },
          animationDuration: 500,
          animationEasingUpdate: "cubicOut" as const,
        },
      ],
    }
  }, [graphNodes, graphLinks])

  const handleEvents = useMemo(() => {
    return {
      mouseover: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value) return
        const value = params.data.value
        if (value.isCenter) {
          onNodeHover?.(null, true)
        } else {
          const node = dataRef.current?.nodes?.find((n) => n.address === value.address)
          onNodeHover?.(node || null, false)
        }
      },
      mouseout: () => {
        onNodeHover?.(null, false)
      },
      click: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value) return
        const value = params.data.value
        if (value.isCenter) {
          onNodeClick?.(null, true)
        } else {
          const node = dataRef.current?.nodes?.find((n) => n.address === value.address)
          onNodeClick?.(node || null, false)
        }
      },
      dblclick: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value?.address) return
        onNodeDoubleClick?.(params.data.value.address)
      },
    }
  }, [onNodeHover, onNodeClick, onNodeDoubleClick])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No graph data available
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50" style={{ height }}>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: "100%", width: "100%" }}
        onEvents={handleEvents}
        opts={{ renderer: "canvas" }}
      />
    </div>
  )
}

export function AddressGraphLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-blue-500 text-blue-600" />
        <span>Center</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-green-500 text-green-600" />
        <span>Low</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-yellow-500 text-yellow-600" />
        <span>Med</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-red-500 text-red-600" />
        <span>High</span>
      </div>
      <div className="border-l border-gray-300 pl-3 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3 text-blue-500" />
        <span>In</span>
      </div>
      <div className="flex items-center gap-1">
        <ArrowRight className="w-3 h-3 text-orange-500" />
        <span>Out</span>
      </div>
      <div className="flex items-center gap-1">
        <ArrowLeftRight className="w-3 h-3 text-purple-500" />
        <span>Both</span>
      </div>
    </div>
  )
}
