import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Route } from "lucide-react"
import { LoadingSpinner } from "@/components/common"
import {
  PathSearchForm,
  PathVisualization,
  PathDetails,
  AddressRiskCard,
} from "@/components/pathfinder"
import { orchestrationService } from "@/services"

export function PathFinderPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Sync with URL
  const urlFrom = searchParams.get("from") || ""
  const urlTo = searchParams.get("to") || ""

  const [fromAddress, setFromAddress] = useState(urlFrom)
  const [toAddress, setToAddress] = useState(urlTo)
  const [maxDepth, setMaxDepth] = useState(5)
  const [queryParams, setQueryParams] = useState<{
    from: string
    to: string
    maxDepth: number
  } | null>(null)

  // Sync with URL changes
  useEffect(() => {
    const from = searchParams.get("from") || ""
    const to = searchParams.get("to") || ""
    if (from !== fromAddress) setFromAddress(from)
    if (to !== toAddress) setToAddress(to)
  }, [searchParams])

  // Fetch connection data
  const connectionQuery = useQuery({
    queryKey: ["connection", queryParams?.from, queryParams?.to, queryParams?.maxDepth],
    queryFn: () =>
      orchestrationService.findConnection(queryParams!.from, queryParams!.to, {
        maxDepth: queryParams!.maxDepth,
      }),
    enabled: !!queryParams,
  })

  const handleSearch = (from: string, to: string, depth: number) => {
    setQueryParams({ from, to, maxDepth: depth })
    setSearchParams({ from, to })
  }

  const connection = connectionQuery.data
  const pathFound = connection?.path?.found

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header with Search Form */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Route className="w-6 h-6 text-blue-600" />
              Path Finder
            </h1>
            <p className="text-gray-600 mt-1">
              Find the shortest transaction path between two addresses
            </p>
          </div>

          {/* Search Form */}
          <PathSearchForm
            fromAddress={fromAddress}
            toAddress={toAddress}
            maxDepth={maxDepth}
            isLoading={connectionQuery.isLoading}
            onFromAddressChange={setFromAddress}
            onToAddressChange={setToAddress}
            onMaxDepthChange={setMaxDepth}
            onSearch={handleSearch}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {connectionQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">
                Searching for connection path...
              </p>
            </div>
          )}

          {/* Results */}
          {connection && !connectionQuery.isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Path Visualization */}
              <div className="lg:col-span-2">
                <PathVisualization
                  path={connection.path.path}
                  found={!!pathFound}
                  maxDepth={connection.path.maxDepth}
                  message={connection.path.message}
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Source Risk */}
                <AddressRiskCard
                  title="Source Address Risk"
                  risk={connection.fromAddressRisk}
                />

                {/* Target Risk */}
                <AddressRiskCard
                  title="Target Address Risk"
                  risk={connection.toAddressRisk}
                />

                {/* Path Details */}
                {pathFound && <PathDetails path={connection.path.path} />}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!connectionQuery.isLoading && !connection && (
            <div className="text-center py-12">
              <Route className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter two addresses to find the connection path between them
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
