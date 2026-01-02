import { useRef, useEffect } from "react"
import { Network, DataSet, Options } from "vis-network/standalone"
import { Circle } from "lucide-react"
import type { GraphAddressInfo } from "@/types"

interface HighRiskGraphProps {
  addresses: GraphAddressInfo[]
  onNodeHover?: (address: GraphAddressInfo | null) => void
  onNodeClick?: (address: GraphAddressInfo | null) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
}

// Color helpers
function getRiskColor(riskScore: number | undefined): string {
  if (riskScore === undefined) return "#9CA3AF"
  if (riskScore >= 0.8) return "#F87171"
  if (riskScore >= 0.6) return "#FB923C"
  if (riskScore >= 0.4) return "#FBBF24"
  return "#34D399"
}

function getRiskBorderColor(riskScore: number | undefined): string {
  if (riskScore === undefined) return "#6B7280"
  if (riskScore >= 0.8) return "#EF4444"
  if (riskScore >= 0.6) return "#F97316"
  if (riskScore >= 0.4) return "#F59E0B"
  return "#10B981"
}

export function HighRiskGraph({
  addresses,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  height = "500px",
}: HighRiskGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const callbacksRef = useRef({ onNodeHover, onNodeClick, onNodeDoubleClick })

  // Update callbacks ref without triggering re-render
  useEffect(() => {
    callbacksRef.current = { onNodeHover, onNodeClick, onNodeDoubleClick }
  }, [onNodeHover, onNodeClick, onNodeDoubleClick])

  useEffect(() => {
    if (!containerRef.current || !addresses.length) return

    const nodes = addresses.map((addr) => ({
      id: addr.address,
      label: `${addr.address.slice(0, 6)}...${addr.address.slice(-4)}`,
      color: {
        background: getRiskColor(addr.riskScore),
        border: getRiskBorderColor(addr.riskScore),
      },
      size: Math.min(30, 15 + (addr.riskScore || 0) * 15),
      borderWidth: 2,
    }))

    const edges: Array<{
      id: string
      from: string
      to: string
      color: { color: string; opacity: number }
      width: number
    }> = []

    // Create edges based on shared clusters or tags
    for (let i = 0; i < addresses.length; i++) {
      for (let j = i + 1; j < addresses.length; j++) {
        const addr1 = addresses[i]
        const addr2 = addresses[j]

        if (addr1.clusterId && addr1.clusterId === addr2.clusterId) {
          edges.push({
            id: `edge-${i}-${j}`,
            from: addr1.address,
            to: addr2.address,
            color: { color: "#9CA3AF", opacity: 0.5 },
            width: 1,
          })
        } else if (addr1.tags && addr2.tags) {
          const sharedTags = addr1.tags.filter((t) => addr2.tags?.includes(t))
          if (sharedTags.length > 0) {
            edges.push({
              id: `edge-${i}-${j}`,
              from: addr1.address,
              to: addr2.address,
              color: { color: "#6B7280", opacity: 0.3 },
              width: 1,
            })
          }
        }
      }
    }

    const nodesDataSet = new DataSet(nodes)
    const edgesDataSet = new DataSet(edges)

    const options: Options = {
      nodes: {
        shape: "dot",
        font: { size: 10, color: "#374151" },
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        smooth: { enabled: true, type: "continuous", roundness: 0.5 },
        shadow: false,
      },
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -100,
          centralGravity: 0.01,
          springLength: 200,
          springConstant: 0.05,
        },
        stabilization: { iterations: 100 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 0,
      },
    }

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
      options
    )

    network.on("hoverNode", (params) => {
      const nodeId = params.node as string
      const addr = addresses.find((a) => a.address === nodeId)
      callbacksRef.current.onNodeHover?.(addr || null)
    })

    network.on("blurNode", () => {
      callbacksRef.current.onNodeHover?.(null)
    })

    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        const addr = addresses.find((a) => a.address === nodeId)
        callbacksRef.current.onNodeClick?.(addr || null)
      }
    })

    network.on("doubleClick", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        callbacksRef.current.onNodeDoubleClick?.(nodeId)
      }
    })

    network.on("stabilizationIterationsDone", () => {
      network.setOptions({ physics: { enabled: false } })
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [addresses]) // Only depend on addresses, not callbacks

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="border border-gray-200 rounded-lg bg-gray-50"
    />
  )
}

// Legend component
export function HighRiskGraphLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div className="flex items-center gap-2">
        <Circle className="w-4 h-4 fill-red-400 text-red-500" />
        <span>Critical (≥0.8)</span>
      </div>
      <div className="flex items-center gap-2">
        <Circle className="w-4 h-4 fill-orange-400 text-orange-500" />
        <span>High (0.6-0.8)</span>
      </div>
      <div className="flex items-center gap-2">
        <Circle className="w-4 h-4 fill-yellow-400 text-yellow-500" />
        <span>Medium (0.4-0.6)</span>
      </div>
    </div>
  )
}
