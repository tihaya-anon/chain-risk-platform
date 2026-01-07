import { useRef, useEffect } from "react"
import { Network, DataSet, Options, Data } from "vis-network/standalone"
import { Circle } from "lucide-react"
import type { AddressNeighborsResponse, NeighborInfo } from "@/api/generated"

interface AddressGraphProps {
  data: AddressNeighborsResponse | null
  selectedNode?: string | null
  onNodeHover?: (neighbor: NeighborInfo | null, isCenter?: boolean) => void
  onNodeClick?: (neighbor: NeighborInfo | null, isCenter?: boolean) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
}

function getDirectionColor(direction?: string): string {
  switch (direction) {
    case "incoming": return "#10B981"
    case "outgoing": return "#EF4444"
    case "both": return "#8B5CF6"
    default: return "#6B7280"
  }
}

function getDirectionHighlight(direction?: string): string {
  switch (direction) {
    case "incoming": return "#6EE7B7"
    case "outgoing": return "#FCA5A5"
    case "both": return "#C4B5FD"
    default: return "#D1D5DB"
  }
}

function getRiskBasedSize(riskScore?: number, transferCount?: number): number {
  const baseSize = 15
  const riskBonus = (riskScore || 0) * 10
  const txBonus = Math.min((transferCount || 0) / 20, 10)
  return baseSize + riskBonus + txBonus
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// Distribute nodes evenly within range, avoiding boundaries
// Divides range into (count+1) segments, places nodes at segment boundaries 1..count
function getNodePosition(
  direction: string | undefined,
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

  // Place at (index+1)/(count+1) of the range - never at boundaries
  const angle = startDeg + ((index + 1) / (count + 1)) * (endDeg - startDeg)

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
    const neighbors = data.neighbors || []

    const incoming = neighbors.filter(n => n.direction === "incoming")
    const outgoing = neighbors.filter(n => n.direction === "outgoing")
    const both = neighbors.filter(n => n.direction === "both")
    const totalByType = { in: incoming.length, out: outgoing.length, both: both.length }

    let inIdx = 0, outIdx = 0, bothIdx = 0

    const nodes: any[] = [
      {
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
      },
    ]

    neighbors.forEach((n: NeighborInfo) => {
      let idx = 0
      if (n.direction === "incoming") idx = inIdx++
      else if (n.direction === "outgoing") idx = outIdx++
      else idx = bothIdx++

      const pos = getNodePosition(n.direction, idx, totalByType)

      nodes.push({
        id: n.address || "",
        label: `${n.address?.slice(0, 6)}...${n.address?.slice(-4)}`,
        x: pos.x,
        y: pos.y,
        color: {
          background: getDirectionColor(n.direction),
          border: getDirectionColor(n.direction),
          highlight: { background: getDirectionHighlight(n.direction), border: getDirectionColor(n.direction) },
          hover: { background: getDirectionHighlight(n.direction), border: getDirectionColor(n.direction) },
        },
        size: getRiskBasedSize(n.riskScore, n.transferCount),
        borderWidth: 2,
        font: { color: "#374151", size: 10 },
      })
    })

    const edges: any[] = neighbors.map((n: NeighborInfo, i: number) => {
      const isIncoming = n.direction === "incoming"
      const isBoth = n.direction === "both"

      return {
        id: `edge-${i}`,
        from: isIncoming ? n.address || "" : centerAddress,
        to: isIncoming ? centerAddress : n.address || "",
        arrows: isBoth ? "to;from" : "to",
        color: { color: "#94A3B8", highlight: "#64748B", hover: "#64748B" },
        width: Math.min(1 + (n.transferCount || 0) / 50, 4),
        label: n.transferCount ? String(n.transferCount) : "",
        font: { size: 9, color: "#6B7280", strokeWidth: 0 },
        smooth: { enabled: true, type: "curvedCCW", roundness: 0.15 },
      }
    })

    const options: Options = {
      nodes: {
        shape: "dot",
        borderWidth: 2,
        shadow: { enabled: true, size: 5, x: 2, y: 2 },
      },
      edges: {
        smooth: { enabled: true, type: "curvedCCW", roundness: 0.15 },
      },
      physics: {
        enabled: false,
      },
      interaction: {
        hover: true,
        tooltipDelay: 0,
        zoomView: true,
        dragView: true,
        dragNodes: true,
      },
    }

    const graphData: Data = {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges),
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
        const neighbor = currentData.neighbors?.find((n) => n.address === nodeId)
        callbacksRef.current.onNodeHover?.(neighbor || null, false)
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
            const neighbor = currentData.neighbors?.find((n) => n.address === nodeId)
            callbacksRef.current.onNodeClick?.(neighbor || null, false)
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
        <span>In</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-red-500 text-red-600" />
        <span>Out</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="w-3 h-3 fill-purple-500 text-purple-600" />
        <span>Both</span>
      </div>
    </div>
  )
}
