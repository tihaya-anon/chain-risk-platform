import { useRef, useEffect } from "react"
import { Network, DataSet, Options } from "vis-network/standalone"
import type { AddressNeighborsResponse, NeighborInfo } from "@/api/generated"

interface AddressGraphProps {
  data: AddressNeighborsResponse | null
  onNodeClick?: (address: string) => void
  height?: string
}

export function AddressGraph({ data, onNodeClick, height = "400px" }: AddressGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  useEffect(() => {
    if (!containerRef.current || !data) return

    const centerAddress = data.address || ""
    const neighbors = data.neighbors || []

    const nodes = [
      { id: centerAddress, label: `${centerAddress?.slice(0, 8)}...`, color: "#3B82F6", size: 25, borderWidth: 3 },
      ...neighbors.map((n: NeighborInfo) => ({
        id: n.address || "",
        label: `${n.address?.slice(0, 6)}...`,
        color: n.direction === "incoming" ? "#10B981" : n.direction === "outgoing" ? "#EF4444" : "#6B7280",
        size: 15 + (n.transferCount || 0) / 10,
      }))
    ]

    const edges = neighbors.map((n: NeighborInfo, i: number) => ({
      id: `edge-${i}`,
      from: n.direction === "incoming" ? n.address || "" : centerAddress,
      to: n.direction === "incoming" ? centerAddress : n.address || "",
      arrows: "to",
      color: { color: "#94A3B8" },
      label: String(n.transferCount || ""),
    }))

    const options: Options = {
      nodes: { shape: "dot", font: { size: 10, color: "#374151" }, borderWidth: 2 },
      edges: { smooth: { enabled: true, type: "curvedCW", roundness: 0.2 } },
      physics: { enabled: true, solver: "forceAtlas2Based", stabilization: { iterations: 50 } },
      interaction: { hover: true },
    }

    const network = new Network(containerRef.current, { nodes: new DataSet(nodes), edges: new DataSet(edges) }, options)

    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        onNodeClick?.(params.nodes[0] as string)
      }
    })

    networkRef.current = network
    return () => network.destroy()
  }, [data, onNodeClick])

  if (!data) {
    return <div className="flex items-center justify-center h-64 text-gray-500">No graph data</div>
  }

  return <div ref={containerRef} style={{ height, width: "100%" }} className="border rounded-lg bg-gray-50" />
}
