import { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Circle, AlertCircle } from "lucide-react"
import { Card } from "@/components/common"

interface PathNode {
  address: string
  riskScore?: number
  tags?: string[]
  value?: string
}

interface PathVisualizationProps {
  path: PathNode[]
  found: boolean
  maxDepth?: number
  message?: string
}

function getRiskColor(riskScore?: number): string {
  if (riskScore === undefined) return "#9CA3AF"
  if (riskScore >= 0.8) return "#F87171"
  if (riskScore >= 0.6) return "#FB923C"
  if (riskScore >= 0.4) return "#FBBF24"
  return "#34D399"
}

function formatAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatValue(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (num >= 1e18) return `${(num / 1e18).toFixed(2)} ETH`
  return value
}

export function PathVisualization({ path, found, maxDepth, message }: PathVisualizationProps) {
  const option = useMemo(() => {
    if (!found || !path.length) return {}

    const spacing = 180
    const nodes = path.map((node, index) => {
      const isStart = index === 0
      const isEnd = index === path.length - 1

      let color = getRiskColor(node.riskScore)
      if (isStart) color = "#3B82F6"
      else if (isEnd) color = "#8B5CF6"

      return {
        id: node.address,
        name: formatAddress(node.address),
        x: index * spacing,
        y: 0,
        symbolSize: isStart || isEnd ? 40 : 28,
        itemStyle: {
          color,
          borderColor: color,
          borderWidth: isStart || isEnd ? 3 : 2,
        },
        label: {
          show: true,
          position: "bottom" as const,
          distance: 10,
          formatter: isStart ? "{b}\n(Source)" : isEnd ? "{b}\n(Target)" : "{b}",
          fontSize: 11,
          color: "#374151",
        },
        value: {
          address: node.address,
          riskScore: node.riskScore,
          tags: node.tags,
          isStart,
          isEnd,
        },
      }
    })

    const links = path.slice(0, -1).map((node, index) => ({
      source: node.address,
      target: path[index + 1].address,
      lineStyle: {
        color: "#6B7280",
        width: 2,
        curveness: 0,
      },
      label: {
        show: !!node.value,
        formatter: node.value ? formatValue(node.value) : "",
        fontSize: 10,
        color: "#6B7280",
      },
      symbol: ["none", "arrow"],
      symbolSize: [0, 10],
    }))

    return {
      tooltip: {
        trigger: "item" as const,
        formatter: (params: { data?: { value?: { address: string; riskScore?: number; tags?: string[] } } }) => {
          const value = params.data?.value
          if (!value) return ""
          const lines = [`<strong>${value.address}</strong>`]
          if (value.riskScore !== undefined) {
            lines.push(`Risk: ${(value.riskScore * 100).toFixed(0)}%`)
          }
          if (value.tags?.length) {
            lines.push(`Tags: ${value.tags.slice(0, 3).join(", ")}`)
          }
          return lines.join("<br/>")
        },
      },
      series: [
        {
          type: "graph" as const,
          layout: "none" as const,
          data: nodes,
          links,
          roam: true,
          lineStyle: {
            opacity: 0.9,
          },
          emphasis: {
            focus: "adjacency" as const,
            itemStyle: {
              borderWidth: 4,
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.3)",
            },
          },
          animationDuration: 800,
        },
      ],
    }
  }, [path, found])

  return (
    <Card
      title={found ? "Connection Path" : "No Path Found"}
      subtitle={
        found
          ? `${path.length} hops between addresses`
          : maxDepth
            ? `No connection within ${maxDepth} hops`
            : "No connection found"
      }
    >
      {found ? (
        <>
          <div className="border border-gray-200 rounded-lg bg-gray-50" style={{ height: "400px" }}>
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "canvas" }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 fill-blue-500 text-blue-500" />
              <span>Source</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 fill-purple-500 text-purple-500" />
              <span>Target</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 fill-green-500 text-green-500" />
              <span>Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 fill-red-500 text-red-500" />
              <span>High Risk</span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto" />
          <p className="text-gray-500 mt-4">{message || "No direct or indirect connection found"}</p>
          <p className="text-sm text-gray-400 mt-2">
            Try increasing the max depth or check if the addresses are correct
          </p>
        </div>
      )}
    </Card>
  )
}
