import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Network, Search } from "lucide-react"
import { Card, Button, Input, LoadingSpinner } from "@/components/common"
import { AddressGraph } from "@/components/graph"
import {
  useGraphControllerGetAddressNeighbors,
  useGraphControllerGetAddressInfo,
} from "@/api/generated"

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const addressParam = searchParams.get("address") || ""
  const [searchAddress, setSearchAddress] = useState(addressParam)
  const [queryAddress, setQueryAddress] = useState(addressParam)

  const neighborsQuery = useGraphControllerGetAddressNeighbors(
    queryAddress,
    { depth: 1, limit: 20 },
    { query: { enabled: !!queryAddress } }
  )
  const addressInfoQuery = useGraphControllerGetAddressInfo(queryAddress, {
    query: { enabled: !!queryAddress },
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchAddress.trim()) {
      const normalized = searchAddress.trim().toLowerCase()
      setQueryAddress(normalized)
      setSearchParams({ address: normalized })
    }
  }

  const handleNodeClick = (address: string) => {
    setSearchAddress(address)
    setQueryAddress(address)
    setSearchParams({ address })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-purple-600" />
              Graph Explorer
            </h1>
            <p className="text-gray-600 mt-1">Explore address connections in the graph</p>
          </div>
          <Card>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter Ethereum address (0x...)"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                />
              </div>
              <Button type="submit" loading={neighborsQuery.isLoading}>
                <Search className="w-4 h-4 mr-1" />
                Explore
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {neighborsQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {neighborsQuery.data && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Card title="Network Graph" subtitle="Click a node to explore">
                  <AddressGraph
                    data={neighborsQuery.data}
                    onNodeClick={handleNodeClick}
                    height="500px"
                  />
                </Card>
              </div>
              <div>
                <Card title="Address Info">
                  {addressInfoQuery.data ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="text-gray-500">Address</label>
                        <p className="font-mono text-xs break-all">
                          {addressInfoQuery.data.address}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-gray-500">Risk Score</label>
                          <p className="font-medium">
                            {addressInfoQuery.data.riskScore?.toFixed(2) || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="text-gray-500">TX Count</label>
                          <p className="font-medium">{addressInfoQuery.data.txCount}</p>
                        </div>
                      </div>
                      <div className="pt-2">
                        <Link
                          to={`/address?q=${queryAddress}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View Full Analysis →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Select an address to view info
                    </p>
                  )}
                </Card>
              </div>
            </div>
          )}

          {!neighborsQuery.isLoading && !neighborsQuery.data && !queryAddress && (
            <div className="text-center py-12">
              <Network className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter an address to explore its connections
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
