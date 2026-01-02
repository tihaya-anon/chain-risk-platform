import { useEffect, useRef } from "react"
import { Network, DataSet, Options } from "vis-network/standalone"
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

export function PathVisualization({
  path,
  found,
  maxDepth,
  message,
}: PathVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  useEffect(() => {
    if (!containerRef.current || !found || !path.length) return

    // Build nodes and edges
    const nodes: Array<{
      id: string
      label: string
      color: { background: string; border: string }
      size: number
      font?: { color: string }
      borderWidth: number
    }> = []
    const edges: Array<{
      id: string
      from: string
      to: string
      arrows: string
      label?: string
      color: { color: string }
      width: number
    }> = []

    path.forEach((node, index) => {
      const isStart = index === 0
      const isEnd = index === path.length - 1

      let bgColor = "#9CA3AF"
      let borderColor = "#6B7280"

      if (isStart) {
        bgColor = "#3B82F6"
        borderColor = "#2563EB"
      } else if (isEnd) {
        bgColor = "#8B5CF6"
        borderColor = "#7C3AED"
      } else if (node.riskScore !== undefined) {
        if (node.riskScore >= 0.8) {
          bgColor = "#F87171"
          borderColor = "#EF4444"
        } else if (node.riskScore >= 0.6) {
          bgColor = "#FB923C"
          borderColor = "#F97316"
        } else if (node.riskScore >= 0.4) {
          bgColor = "#FBBF24"
          borderColor = "#F59E0B"
        } else {
          bgColor = "#34D399"
          borderColor = "#10B981"
        }
      }

      nodes.push({
        id: node.address,
        label: `${node.address.slice(0, 6)}...${node.address.slice(-4)}${
          isStart ? "\n(Source)" : isEnd ? "\n(Target)" : ""
        }`,
        color: { background: bgColor, border: borderColor },
        size: isStart || isEnd ? 30 : 20,
        font: isStart || isEnd ? { color: "#FFFFFF" } : undefined,
        borderWidth: isStart || isEnd ? 3 : 2,
      })

      if (index < path.length - 1) {
        const nextNode = path[index + 1]
        edges.push({
          id: `edge-${index}`,
          from: node.address,
          to: nextNode.address,
          arrows: "to",
          label: node.value ? formatValue(node.value) : undefined,
          color: { color: "#6B7280" },
          width: 2,
        })
      }
    })

    const nodesDataSet = new DataSet(nodes)
    const edgesDataSet = new DataSet(edges)

    const options: Options = {
      nodes: {
        shape: "dot",
        font: { size: 12, color: "#374151" },
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        smooth: { enabled: true, type: "curvedCW", roundness: 0.2 },
        shadow: true,
        font: { size: 10, align: "middle" },
      },
      physics: {
        enabled: true,
        solver: "hierarchicalRepulsion",
        hierarchicalRepulsion: {
          nodeDistance: 150,
          springLength: 150,
        },
        stabilization: { iterations: 50 },
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: "LR",
          sortMethod: "directed",
          levelSeparation: 200,
          nodeSpacing: 100,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
      },
    }

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
      options
    )

    network.on("stabilizationIterationsDone", () => {
      network.setOptions({ physics: { enabled: false } })
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
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
          <div
            ref={containerRef}
            style={{ height: "400px", width: "100%" }}
            className="border border-gray-200 rounded-lg bg-gray-50"
          />
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
          <p className="text-gray-500 mt-4">
            {message || "No direct or indirect connection found"}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Try increasing the max depth or check if the addresses are correct
          </p>
        </div>
      )}
    </Card>
  )
}

// Helper function
function formatValue(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (num >= 1e18) return `${(num / 1e18).toFixed(2)} ETH`
  return value
}
