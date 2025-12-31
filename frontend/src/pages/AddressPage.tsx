import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { Search, Network, Route, XCircle } from "lucide-react"
import { Button, Input, Card, LoadingSpinner } from "@/components/common"
import {
  BasicInfoSection,
  RiskSection,
  GraphInfoSection,
  ClusterSection,
  NeighborsSection,
} from "@/components/address"
import { orchestrationService } from "@/services"

export function AddressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get("q") || ""

  const [searchAddress, setSearchAddress] = useState(urlQuery)
  const [queryAddress, setQueryAddress] = useState(urlQuery)

  // Sync with URL changes
  useEffect(() => {
    const q = searchParams.get("q") || ""
    if (q && q !== queryAddress) {
      setSearchAddress(q)
      setQueryAddress(q)
    }
  }, [searchParams, queryAddress])

  // Use orchestration API for comprehensive data
  const analysisQuery = useQuery({
    queryKey: ["addressAnalysis", queryAddress],
    queryFn: () =>
      orchestrationService.getAddressAnalysis(queryAddress, {
        neighborDepth: 1,
        neighborLimit: 10,
      }),
    enabled: !!queryAddress,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchAddress.trim()) {
      const normalized = searchAddress.trim().toLowerCase()
      setQueryAddress(normalized)
      setSearchParams({ q: normalized })
    }
  }

  const data = analysisQuery.data

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header with Search */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-6 h-6 text-blue-600" />
              Address Analysis
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive blockchain address analysis with graph data
            </p>
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
              <Button type="submit" loading={analysisQuery.isLoading}>
                <Search className="w-4 h-4 mr-1" />
                Analyze
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {analysisQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">
                Loading comprehensive analysis...
              </p>
            </div>
          )}

          {/* Error */}
          {analysisQuery.error && (
            <Card>
              <div className="text-center py-8 text-red-500">
                <XCircle className="w-12 h-12 mx-auto" />
                <p className="mt-4">Failed to load address analysis</p>
                <p className="text-sm text-gray-500 mt-2">
                  {(analysisQuery.error as Error).message}
                </p>
              </div>
            </Card>
          )}

          {/* Results */}
          {data && !analysisQuery.isLoading && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="flex gap-4">
                <Link
                  to={`/graph?address=${data.address}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Network className="w-4 h-4" />
                  View in Graph Explorer
                </Link>
                <Link
                  to={`/path-finder?from=${data.address}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Route className="w-4 h-4" />
                  Find Connections
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Basic Information" className="lg:col-span-2">
                  <BasicInfoSection data={data} />
                </Card>

                <Card title="Risk Assessment">
                  <RiskSection data={data} />
                </Card>

                <Card title="Graph Analysis" className="lg:col-span-2">
                  <GraphInfoSection data={data} />
                </Card>

                <Card title="Cluster">
                  <ClusterSection data={data} />
                </Card>

                <Card
                  title="Connected Addresses"
                  subtitle="Top neighbors by transfer count"
                  className="lg:col-span-3"
                >
                  <NeighborsSection data={data} />
                </Card>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!analysisQuery.isLoading && !analysisQuery.error && !data && !queryAddress && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter an address to start comprehensive analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
