import { useMemo, useRef } from "react"
import ReactECharts from "echarts-for-react"
import { Circle } from "lucide-react"
import type { GraphAddressInfo } from "@/api/generated"

interface HighRiskGraphProps {
  addresses: GraphAddressInfo[]
  selectedNode?: string | null
  onNodeHover?: (address: GraphAddressInfo | null) => void
  onNodeClick?: (address: GraphAddressInfo | null) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
}

interface NodeValue {
  address: string
  riskScore?: number
  tags?: string[]
  clusterId?: string
}

function getRiskColor(riskScore?: number): string {
  if (riskScore === undefined) return "#9CA3AF"
  if (riskScore >= 0.8) return "#F87171"
  if (riskScore >= 0.6) return "#FB923C"
  if (riskScore >= 0.4) return "#FBBF24"
  return "#34D399"
}

// Darker version for selected border
function getRiskBorderColor(riskScore?: number): string {
  if (riskScore === undefined) return "#4B5563"
  if (riskScore >= 0.8) return "#B91C1C"
  if (riskScore >= 0.6) return "#C2410C"
  if (riskScore >= 0.4) return "#A16207"
  return "#047857"
}

export function HighRiskGraph({
  addresses,
  selectedNode,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  height = "500px",
}: HighRiskGraphProps) {
  const chartRef = useRef<ReactECharts>(null)
  const addressesRef = useRef(addresses)
  addressesRef.current = addresses

  const { nodes, links } = useMemo(() => {
    const graphNodes = addresses.map((addr) => {
      const isSelected = selectedNode === addr.address
      const nodeColor = getRiskColor(addr.riskScore)
      const selectedBorderColor = getRiskBorderColor(addr.riskScore)
      
      return {
        id: addr.address,
        name: "",
        value: {
          address: addr.address,
          riskScore: addr.riskScore,
          tags: addr.tags,
          clusterId: addr.clusterId,
        } as NodeValue,
        symbolSize: Math.min(35, 18 + (addr.riskScore || 0) * 17),
        itemStyle: {
          color: nodeColor,
          borderColor: isSelected ? selectedBorderColor : nodeColor,
          borderWidth: isSelected ? 4 : 2,
          shadowBlur: isSelected ? 15 : 0,
          shadowColor: isSelected ? "rgba(0,0,0,0.3)" : "transparent",
        },
      }
    })

    const graphLinks: Array<{
      source: string
      target: string
      lineStyle: { color: string; opacity: number; width: number }
    }> = []

    for (let i = 0; i < addresses.length; i++) {
      for (let j = i + 1; j < addresses.length; j++) {
        const addr1 = addresses[i]
        const addr2 = addresses[j]

        if (addr1.clusterId && addr1.clusterId === addr2.clusterId) {
          graphLinks.push({
            source: addr1.address!,
            target: addr2.address!,
            lineStyle: { color: "#9CA3AF", opacity: 0.6, width: 2 },
          })
        } else if (addr1.tags && addr2.tags) {
          const sharedTags = addr1.tags.filter((t) => addr2.tags?.includes(t))
          if (sharedTags.length > 0) {
            graphLinks.push({
              source: addr1.address!,
              target: addr2.address!,
              lineStyle: { color: "#6B7280", opacity: 0.3, width: 1 },
            })
          }
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks }
  }, [addresses, selectedNode])

  const option = useMemo(() => {
    if (!nodes.length) return {}

    return {
      tooltip: { show: false },
      series: [
        {
          type: "graph" as const,
          layout: "force" as const,
          data: nodes,
          links,
          roam: true,
          draggable: true,
          label: { show: false },
          force: {
            repulsion: 300,
            gravity: 0.1,
            edgeLength: [100, 200],
            friction: 0.6,
          },
          emphasis: {
            focus: "adjacency" as const,
            itemStyle: {
              borderWidth: 3,
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.3)",
            },
          },
          lineStyle: {
            curveness: 0.1,
          },
          animationDuration: 1000,
          animationEasingUpdate: "quinticInOut" as const,
        },
      ],
    }
  }, [nodes, links])

  const handleEvents = useMemo(() => {
    return {
      mouseover: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value) return
        const addr = addressesRef.current.find((a) => a.address === params.data?.value?.address)
        onNodeHover?.(addr || null)
      },
      mouseout: () => {
        onNodeHover?.(null)
      },
      click: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value) return
        const addr = addressesRef.current.find((a) => a.address === params.data?.value?.address)
        onNodeClick?.(addr || null)
      },
      dblclick: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value?.address) return
        onNodeDoubleClick?.(params.data.value.address)
      },
    }
  }, [onNodeHover, onNodeClick, onNodeDoubleClick])

  if (!addresses.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No high-risk addresses found
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
