import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ShieldAlert,
  RefreshCw,
  List,
  Network as NetworkIcon,
  AlertTriangle,
  Activity,
  Users,
} from "lucide-react"
import { Button, Card, LoadingSpinner } from "@/components/common"
import {
  HighRiskGraph,
  HighRiskGraphLegend,
  HighRiskTable,
  SelectedAddressPanel,
} from "@/components/risk"
import { orchestrationService } from "@/services"
import type { GraphAddressInfo } from "@/types"
import { Select } from "@/components/common/Select"

export function HighRiskNetworkPage() {
  const navigate = useNavigate()

  const [threshold, setThreshold] = useState(0.6)
  const [limit, setLimit] = useState(30)
  const [hoveredAddress, setHoveredAddress] = useState<GraphAddressInfo | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<GraphAddressInfo | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")

  // Fetch high risk network
  const highRiskQuery = useQuery({
    queryKey: ["highRiskNetwork", threshold, limit],
    queryFn: () => orchestrationService.getHighRiskNetwork(threshold, limit),
  })

  const addresses = highRiskQuery.data?.highRiskAddresses || []

  // Display selected node if available, otherwise show hovered node
  const displayAddress = selectedAddress || hoveredAddress

  const handleNodeClick = (address: GraphAddressInfo | null) => {
    setSelectedAddress(address)
    // Clear hover state when selecting
    if (address) {
      setHoveredAddress(null)
    }
  }

  const handleNodeHover = (address: GraphAddressInfo | null) => {
    // Only update hover if no node is selected
    if (!selectedAddress) {
      setHoveredAddress(address)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header with Controls */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                <Select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  options={[
                    [0.5, "≥ 0.5 (Medium+)"],
                    [0.6, "≥ 0.6 (High+)"],
                    [0.7, "≥ 0.7 (High)"],
                    [0.8, "≥ 0.8 (Critical)"],
                  ]}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Limit:</label>
                <Select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  options={[
                    [10, "10"],
                    [20, "20"],
                    [30, "30"],
                    [50, "50"],
                    [100, "100"],
                  ]}
                />
              </div>
              <div className="flex items-center gap-2 border-l pl-4">
                <label className="text-sm text-gray-600">View:</label>
                <div className="flex rounded-md overflow-hidden border border-gray-300">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "list"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 hover:cursor-pointer"
                      }`}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode("graph")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "graph"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 hover:cursor-pointer"
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
                  <HighRiskTable addresses={addresses} />
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3">
                    <Card
                      title="Risk Network Graph"
                      subtitle="Click to select, double-click to explore"
                    >
                      <div className="mb-4">
                        <HighRiskGraphLegend />
                      </div>
                      <HighRiskGraph
                        addresses={addresses}
                        selectedNode={selectedAddress?.address}
                        onNodeHover={handleNodeHover}
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={(addr) => navigate(`/graph?address=${addr}`)}
                        height="500px"
                      />
                    </Card>
                  </div>
                  <div>
                    <SelectedAddressPanel
                      address={displayAddress}
                      isSelected={!!selectedAddress}
                      onClearSelection={() => setSelectedAddress(null)}
                      onAnalyze={(addr: string) => navigate(`/address?q=${addr}`)}
                      onExploreGraph={(addr: string) =>
                        navigate(`/graph?address=${addr}`)
                      }
                    />
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
