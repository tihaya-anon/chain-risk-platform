import { useRef, useEffect } from "react"
import { Network, DataSet, Options, Data } from "vis-network/standalone"
import { Circle } from "lucide-react"
import type { AddressNeighborsResponse, GraphNode, GraphEdge } from "@/api/generated"

interface AddressGraphProps {
  data: AddressNeighborsResponse | null
  selectedNode?: string | null
  onNodeHover?: (node: GraphNode | null, isCenter?: boolean) => void
  onNodeClick?: (node: GraphNode | null, isCenter?: boolean) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
}

function getRiskColor(riskScore?: number): string {
  if (riskScore === undefined) return "#6B7280"
  if (riskScore >= 0.8) return "#EF4444"
  if (riskScore >= 0.6) return "#F97316"
  if (riskScore >= 0.4) return "#FBBF24"
  return "#10B981"
}

function getRiskHighlight(riskScore?: number): string {
  if (riskScore === undefined) return "#D1D5DB"
  if (riskScore >= 0.8) return "#FCA5A5"
  if (riskScore >= 0.6) return "#FDBA74"
  if (riskScore >= 0.4) return "#FCD34D"
  return "#6EE7B7"
}

function getRiskBasedSize(riskScore?: number): number {
  const baseSize = 15
  const riskBonus = (riskScore || 0) * 15
  return baseSize + riskBonus
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// Determine node direction based on edges
function getNodeDirection(nodeAddr: string, centerAddr: string, edges: GraphEdge[]): "incoming" | "outgoing" | "both" | undefined {
  const hasIncoming = edges.some(e => e.from === nodeAddr && e.to === centerAddr)
  const hasOutgoing = edges.some(e => e.from === centerAddr && e.to === nodeAddr)
  
  if (hasIncoming && hasOutgoing) return "both"
  if (hasIncoming) return "incoming"
  if (hasOutgoing) return "outgoing"
  return undefined
}

// Get position based on direction
function getNodePosition(
  direction: "incoming" | "outgoing" | "both" | undefined,
  index: number,
  totalByType: { in: number; out: number; both: number }
) {
  const radius = 200

  let startDeg: number, endDeg: number, count: number

  if (direction === "incoming") {
    startDeg = 90
    endDeg = 210
    count = totalByType.in
  } else if (direction === "both") {
    startDeg = 210
    endDeg = 330
    count = totalByType.both
  } else {
    startDeg = 330
    endDeg = 450
    count = totalByType.out
  }

  const angle = count > 0 
    ? startDeg + ((index + 1) / (count + 1)) * (endDeg - startDeg)
    : (startDeg + endDeg) / 2

  const rad = degToRad(angle)
  return {
    x: radius * Math.cos(rad),
    y: -radius * Math.sin(rad),
  }
}

export function AddressGraph({
  data,
  selectedNode,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  height = "500px",
}: AddressGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const callbacksRef = useRef({ onNodeHover, onNodeClick, onNodeDoubleClick })
  const selectedNodeRef = useRef<string | null>(null)
  const dataRef = useRef<AddressNeighborsResponse | null>(null)

  useEffect(() => {
    callbacksRef.current = { onNodeHover, onNodeClick, onNodeDoubleClick }
  }, [onNodeHover, onNodeClick, onNodeDoubleClick])

  useEffect(() => {
    selectedNodeRef.current = selectedNode || null
  }, [selectedNode])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    if (!containerRef.current || !data) return

    const centerAddress = data.address || ""
    const graphNodes = data.nodes || []
    const graphEdges = data.edges || []

    // Classify nodes by direction
    const nodeDirections = new Map<string, "incoming" | "outgoing" | "both" | undefined>()
    graphNodes.forEach(n => {
      if (n.address !== centerAddress) {
        nodeDirections.set(n.address, getNodeDirection(n.address, centerAddress, graphEdges))
      }
    })

    // Count by direction
    const incoming: GraphNode[] = []
    const outgoing: GraphNode[] = []
    const both: GraphNode[] = []

    graphNodes.forEach(n => {
      if (n.address === centerAddress) return
      const dir = nodeDirections.get(n.address)
      if (dir === "incoming") incoming.push(n)
      else if (dir === "outgoing") outgoing.push(n)
      else if (dir === "both") both.push(n)
      else outgoing.push(n) // default
    })

    const totalByType = { in: incoming.length, out: outgoing.length, both: both.length }

    // Build vis-network nodes
    const visNodes: any[] = []
    
    // Center node
    visNodes.push({
      id: centerAddress,
      label: `${centerAddress?.slice(0, 6)}...${centerAddress?.slice(-4)}`,
      x: 0,
      y: 0,
      fixed: { x: true, y: true },
      color: {
        background: "#3B82F6",
        border: "#2563EB",
        highlight: { background: "#60A5FA", border: "#3B82F6" },
        hover: { background: "#60A5FA", border: "#3B82F6" },
      },
      size: 30,
      borderWidth: 3,
      font: { color: "#1F2937", size: 11 },
    })

    // Add other nodes with positions
    let inIdx = 0, outIdx = 0, bothIdx = 0
    graphNodes.forEach((n) => {
      if (n.address === centerAddress) return

      const dir = nodeDirections.get(n.address)
      let idx = 0
      if (dir === "incoming") idx = inIdx++
      else if (dir === "outgoing") idx = outIdx++
      else if (dir === "both") idx = bothIdx++
      else idx = outIdx++

      const pos = getNodePosition(dir, idx, totalByType)

      visNodes.push({
        id: n.address,
        label: `${n.address?.slice(0, 6)}...${n.address?.slice(-4)}`,
        x: pos.x,
        y: pos.y,
        color: {
          background: getRiskColor(n.riskScore),
          border: getRiskColor(n.riskScore),
          highlight: { background: getRiskHighlight(n.riskScore), border: getRiskColor(n.riskScore) },
          hover: { background: getRiskHighlight(n.riskScore), border: getRiskColor(n.riskScore) },
        },
        size: getRiskBasedSize(n.riskScore),
        borderWidth: 2,
        font: { color: "#374151", size: 10 },
      })
    })

    // Build vis-network edges
    const visEdges: any[] = graphEdges.map((e, i) => ({
      id: `edge-${i}`,
      from: e.from,
      to: e.to,
      arrows: "to",
      color: { color: "#94A3B8", highlight: "#64748B", hover: "#64748B" },
      width: Math.min(1 + (e.transferCount || 0) / 50, 4),
      label: e.transferCount ? String(e.transferCount) : "",
      font: { size: 9, color: "#6B7280", strokeWidth: 0 },
      smooth: { enabled: true, type: "curvedCCW", roundness: 0.15 },
    }))

    const options: Options = {
      nodes: {
        shape: "dot",
        borderWidth: 2,
        shadow: { enabled: true, size: 5, x: 2, y: 2 },
      },
      edges: {
        smooth: { enabled: true, type: "curvedCCW", roundness: 0.15 },
      },
      physics: { enabled: false },
      interaction: {
        hover: true,
        tooltipDelay: 0,
        zoomView: true,
        dragView: true,
        dragNodes: true,
      },
    }

    const graphData: Data = {
      nodes: new DataSet(visNodes),
      edges: new DataSet(visEdges),
    }

    const network = new Network(containerRef.current, graphData, options)
    network.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } })

    network.on("hoverNode", (params) => {
      if (selectedNodeRef.current) return
      const nodeId = params.node as string
      const currentData = dataRef.current
      if (!currentData) return

      if (nodeId === currentData.address) {
        callbacksRef.current.onNodeHover?.(null, true)
      } else {
        const node = currentData.nodes?.find((n) => n.address === nodeId)
        callbacksRef.current.onNodeHover?.(node || null, false)
      }
    })

    network.on("blurNode", () => {
      if (!selectedNodeRef.current) {
        callbacksRef.current.onNodeHover?.(null, false)
      }
    })

    network.on("click", (params) => {
      const currentData = dataRef.current
      if (!currentData) return

      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        if (selectedNodeRef.current === nodeId) {
          callbacksRef.current.onNodeClick?.(null, false)
        } else {
          if (nodeId === currentData.address) {
            callbacksRef.current.onNodeClick?.(null, true)
          } else {
            const node = currentData.nodes?.find((n) => n.address === nodeId)
            callbacksRef.current.onNodeClick?.(node || null, false)
          }
        }
      } else {
        callbacksRef.current.onNodeClick?.(null, false)
      }
    })

    network.on("doubleClick", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        callbacksRef.current.onNodeDoubleClick?.(nodeId)
      }
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [data])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No graph data available
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="border border-gray-200 rounded-lg bg-gray-50"
    />
  )
}

export function AddressGraphLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-blue-500 text-blue-600" />
        <span>Center</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-green-500 text-green-600" />
        <span>Low Risk</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-yellow-500 text-yellow-600" />
        <span>Medium</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-red-500 text-red-600" />
        <span>High Risk</span>
      </div>
    </div>
  )
}
