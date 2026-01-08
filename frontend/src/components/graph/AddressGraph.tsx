import { useMemo, useRef } from "react"
import ReactECharts from "echarts-for-react"
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

interface NodeValue {
  address: string
  riskScore?: number
  tags?: string[]
  distance: number
  isCenter: boolean
  transferCount?: number
  totalValue?: string
}

interface TreeNode {
  name: string
  value: NodeValue
  children?: TreeNode[]
  itemStyle?: {
    color: string
    borderColor: string
  }
}

function getRiskColor(riskScore?: number): string {
  if (riskScore === undefined) return "#6B7280"
  if (riskScore >= 0.8) return "#EF4444"
  if (riskScore >= 0.6) return "#F97316"
  if (riskScore >= 0.4) return "#FBBF24"
  return "#10B981"
}

function getRiskBorderColor(riskScore?: number): string {
  if (riskScore === undefined) return "#4B5563"
  if (riskScore >= 0.8) return "#B91C1C"
  if (riskScore >= 0.6) return "#C2410C"
  if (riskScore >= 0.4) return "#B45309"
  return "#047857"
}

function buildRadialTree(
  centerAddress: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): TreeNode {
  const nodeMap = new Map<string, GraphNode>()
  nodes.forEach((node) => nodeMap.set(node.address, node))

  const edgeLookup = new Map<string, { neighbor: string; edge: GraphEdge }[]>()
  edges.forEach((edge) => {
    if (!edgeLookup.has(edge.from)) edgeLookup.set(edge.from, [])
    if (!edgeLookup.has(edge.to)) edgeLookup.set(edge.to, [])
    edgeLookup.get(edge.from)!.push({ neighbor: edge.to, edge })
    edgeLookup.get(edge.to)!.push({ neighbor: edge.from, edge })
  })

  const centerNode = nodeMap.get(centerAddress) || { address: centerAddress, distance: 0 }

  function buildSubtree(node: GraphNode, visited: Set<string>, currentDepth: number): TreeNode {
    visited.add(node.address)

    const isCenter = node.address === centerAddress
    const treeNode: TreeNode = {
      name: "",
      value: {
        address: node.address,
        riskScore: node.riskScore,
        tags: node.tags,
        distance: currentDepth,
        isCenter,
      },
      itemStyle: isCenter
        ? { color: "#3B82F6", borderColor: "#1D4ED8" }
        : { color: getRiskColor(node.riskScore), borderColor: getRiskBorderColor(node.riskScore) },
      children: [],
    }

    const connectedEdges = edgeLookup.get(node.address) || []

    connectedEdges.forEach(({ neighbor, edge }) => {
      if (visited.has(neighbor)) return

      const neighborNode = nodeMap.get(neighbor)
      if (!neighborNode) return

      const neighborDist = neighborNode.distance ?? 999
      if (neighborDist > currentDepth) {
        const childTree = buildSubtree(neighborNode, visited, currentDepth + 1)
        childTree.value.transferCount = edge.transferCount
        childTree.value.totalValue = edge.totalValue
        treeNode.children!.push(childTree)
      }
    })

    if (treeNode.children!.length === 0) {
      delete treeNode.children
    }

    return treeNode
  }

  const visited = new Set<string>()
  return buildSubtree(centerNode as GraphNode, visited, 0)
}

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

  const treeData = useMemo(() => {
    if (!data?.address || !data.nodes) return null
    return buildRadialTree(data.address, data.nodes, data.edges || [])
  }, [data])

  const option = useMemo(() => {
    if (!treeData) return {}

    return {
      tooltip: { show: false },
      series: [
        {
          type: "tree" as const,
          data: [treeData],
          layout: "radial" as const,
          symbol: "circle",
          symbolSize: (value: NodeValue | undefined) => {
            if (!value) return 20
            if (value.isCenter) return 35
            const base = 18
            const riskBonus = (value.riskScore || 0) * 12
            return base + riskBonus
          },
          initialTreeDepth: -1,
          itemStyle: {
            borderWidth: 2,
          },
          lineStyle: {
            color: "#94A3B8",
            width: 1.5,
            curveness: 0.5,
          },
          label: {
            show: false,
          },
          emphasis: {
            focus: "ancestor" as const,
            itemStyle: {
              borderWidth: 3,
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.3)",
            },
          },
          expandAndCollapse: false,
          animationDuration: 550,
          animationDurationUpdate: 750,
        },
      ],
    }
  }, [treeData])

  const handleEvents = useMemo(() => {
    return {
      mouseover: (params: { data?: { value?: NodeValue } }) => {
        if (!params.data?.value || selectedNode) return
        const value = params.data.value
        if (value.isCenter) {
          onNodeHover?.(null, true)
        } else {
          const node = dataRef.current?.nodes?.find((n) => n.address === value.address)
          onNodeHover?.(node || null, false)
        }
      },
      mouseout: () => {
        if (!selectedNode) {
          onNodeHover?.(null, false)
        }
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
  }, [selectedNode, onNodeHover, onNodeClick, onNodeDoubleClick])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No graph data available
      </div>
    )
  }

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Unable to build graph structure
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
