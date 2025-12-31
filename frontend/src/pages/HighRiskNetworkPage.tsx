import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Network, DataSet, Options } from "vis-network/standalone"
import {
  ShieldAlert,
  RefreshCw,
  List,
  Network as NetworkIcon,
  AlertTriangle,
  Activity,
  Users,
  Search,
  ExternalLink,
  Tag,
  Circle,
} from "lucide-react"
import { Button, Card, LoadingSpinner } from "@/components/common"
import { orchestrationService } from "@/services"
import type { GraphAddressInfo } from "@/types"

export function HighRiskNetworkPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  const [threshold, setThreshold] = useState(0.6)
  const [limit, setLimit] = useState(30)
  const [selectedAddress, setSelectedAddress] = useState<GraphAddressInfo | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")

  // Fetch high risk network
  const highRiskQuery = useQuery({
    queryKey: ["highRiskNetwork", threshold, limit],
    queryFn: () => orchestrationService.getHighRiskNetwork(threshold, limit),
  })

  // Render network graph
  useEffect(() => {
    if (
      viewMode !== "graph" ||
      !containerRef.current ||
      !highRiskQuery.data?.highRiskAddresses?.length
    )
      return

    const addresses = highRiskQuery.data.highRiskAddresses

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

    // Hover event - update selected address panel
    network.on("hoverNode", (params) => {
      const nodeId = params.node as string
      const addr = addresses.find((a) => a.address === nodeId)
      if (addr) setSelectedAddress(addr)
    })

    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        const addr = addresses.find((a) => a.address === nodeId)
        if (addr) setSelectedAddress(addr)
      }
    })

    network.on("doubleClick", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        navigate(`/graph?address=${nodeId}`)
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
  }, [highRiskQuery.data, viewMode, navigate])

  const addresses = highRiskQuery.data?.highRiskAddresses || []

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header with Controls */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-600" />
              High Risk Network
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor and analyze high-risk addresses in the network
            </p>
          </div>

          {/* Controls */}
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Risk Threshold:</label>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value={0.5}>≥ 0.5 (Medium+)</option>
                  <option value={0.6}>≥ 0.6 (High+)</option>
                  <option value={0.7}>≥ 0.7 (High)</option>
                  <option value={0.8}>≥ 0.8 (Critical)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Limit:</label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2 border-l pl-4">
                <label className="text-sm text-gray-600">View:</label>
                <div className="flex rounded-md overflow-hidden border border-gray-300">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                      viewMode === "list"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode("graph")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                      viewMode === "graph"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <NetworkIcon className="w-4 h-4" />
                    Graph
                  </button>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => highRiskQuery.refetch()}
                loading={highRiskQuery.isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </Card>

          {/* Stats */}
          {highRiskQuery.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {highRiskQuery.data.threshold}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Risk Threshold
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {highRiskQuery.data.count}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                    <ShieldAlert className="w-4 h-4" />
                    High Risk Addresses
                  </p>
                </div>
              </Card>

              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">
                    {addresses.filter((a) => a.riskScore >= 0.8).length}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                    <Activity className="w-4 h-4" />
                    Critical Risk
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {new Set(addresses.map((a) => a.clusterId).filter(Boolean)).size}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                    <Users className="w-4 h-4" />
                    Unique Clusters
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {highRiskQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">
                Loading high-risk addresses...
              </p>
            </div>
          )}

          {/* Content */}
          {!highRiskQuery.isLoading && addresses.length > 0 && (
            <>
              {viewMode === "list" ? (
                <Card title="High Risk Addresses">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Address
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Risk Score
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            TX Count
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            In/Out
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Tags
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {addresses.map((addr, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm">
                                {addr.address.slice(0, 10)}...
                                {addr.address.slice(-8)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${
                                  addr.riskScore >= 0.8
                                    ? "bg-red-100 text-red-800"
                                    : addr.riskScore >= 0.6
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {addr.riskScore?.toFixed(2) || "N/A"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{addr.txCount}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-green-600">{addr.incomingCount}</span>
                              {" / "}
                              <span className="text-red-600">{addr.outgoingCount}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {addr.tags?.slice(0, 3).map((tag, j) => (
                                  <span
                                    key={j}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                                  >
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                  </span>
                                ))}
                                {addr.tags && addr.tags.length > 3 && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded">
                                    +{addr.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigate(`/address?q=${addr.address}`)}
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm cursor-pointer"
                                >
                                  <Search className="w-3 h-3" />
                                  Analyze
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/graph?address=${addr.address}`)
                                  }
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm cursor-pointer"
                                >
                                  <NetworkIcon className="w-3 h-3" />
                                  Graph
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Graph */}
                  <div className="lg:col-span-3">
                    <Card
                      title="Risk Network Graph"
                      subtitle="Double-click a node to explore"
                    >
                      <div className="mb-4 flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-red-600 text-red-600" />
                          <span>Critical (≥0.8)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-orange-500 text-orange-500" />
                          <span>High (0.6-0.8)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          <span>Medium (0.4-0.6)</span>
                        </div>
                      </div>
                      <div
                        ref={containerRef}
                        style={{ height: "500px", width: "100%" }}
                        className="border border-gray-200 rounded-lg bg-gray-50"
                      />
                    </Card>
                  </div>

                  {/* Selected Address Info */}
                  <div>
                    <Card title="Selected Address">
                      {selectedAddress ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-500">Address</label>
                            <p className="font-mono text-xs break-all">
                              {selectedAddress.address}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500">Risk</label>
                              <p className="font-medium text-red-600">
                                {selectedAddress.riskScore?.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">TX</label>
                              <p className="font-medium">{selectedAddress.txCount}</p>
                            </div>
                          </div>
                          {selectedAddress.tags && selectedAddress.tags.length > 0 && (
                            <div>
                              <label className="text-xs text-gray-500">Tags</label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedAddress.tags.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                                  >
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="pt-3 border-t space-y-2">
                            <Button
                              size="sm"
                              className="w-full justify-start"
                              onClick={() =>
                                navigate(`/address?q=${selectedAddress.address}`)
                              }
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Full Analysis
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() =>
                                navigate(`/graph?address=${selectedAddress.address}`)
                              }
                            >
                              <NetworkIcon className="w-4 h-4 mr-2" />
                              Explore Graph
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-4">
                          Click a node to see details
                        </p>
                      )}
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!highRiskQuery.isLoading && addresses.length === 0 && (
            <div className="text-center py-12">
              <ShieldAlert className="w-16 h-16 text-green-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                No high-risk addresses found above threshold {threshold}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions - softer color palette
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
