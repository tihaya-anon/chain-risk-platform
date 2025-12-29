import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Card, LoadingSpinner, RiskBadge } from '@/components/common'
import { addressService, riskService } from '@/services'
import type { AddressInfo, AddressStats, RiskScore } from '@/types'

export function AddressPage() {
  const [searchAddress, setSearchAddress] = useState('')
  const [queryAddress, setQueryAddress] = useState('')

  const addressQuery = useQuery({
    queryKey: ['address', queryAddress],
    queryFn: () => addressService.getAddressInfo(queryAddress),
    enabled: !!queryAddress,
  })

  const statsQuery = useQuery({
    queryKey: ['addressStats', queryAddress],
    queryFn: () => addressService.getAddressStats(queryAddress),
    enabled: !!queryAddress,
  })

  const riskQuery = useQuery({
    queryKey: ['addressRisk', queryAddress],
    queryFn: () => riskService.scoreAddress({ address: queryAddress }),
    enabled: !!queryAddress,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchAddress.trim()) {
      setQueryAddress(searchAddress.trim())
    }
  }

  const isLoading = addressQuery.isLoading || statsQuery.isLoading || riskQuery.isLoading
  const hasData = addressQuery.data || statsQuery.data || riskQuery.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Address Lookup</h1>
        <p className="text-gray-600 mt-1">
          Search and analyze blockchain addresses
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Enter Ethereum address (0x...)"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
            />
          </div>
          <Button type="submit" loading={isLoading}>
            Search
          </Button>
        </form>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12">
          <LoadingSpinner size="lg" />
          <p className="text-center text-gray-500 mt-4">Loading address data...</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Address Info */}
          <Card title="Address Info" className="lg:col-span-2">
            {addressQuery.data ? (
              <AddressInfoDisplay data={addressQuery.data} />
            ) : addressQuery.error ? (
              <ErrorDisplay message="Failed to load address info" />
            ) : null}
          </Card>

          {/* Risk Score */}
          <Card title="Risk Assessment">
            {riskQuery.data ? (
              <RiskScoreDisplay data={riskQuery.data} />
            ) : riskQuery.error ? (
              <ErrorDisplay message="Failed to load risk score" />
            ) : null}
          </Card>

          {/* Stats */}
          <Card title="Transaction Statistics" className="lg:col-span-3">
            {statsQuery.data ? (
              <StatsDisplay data={statsQuery.data} />
            ) : statsQuery.error ? (
              <ErrorDisplay message="Failed to load statistics" />
            ) : null}
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasData && !queryAddress && (
        <div className="text-center py-12">
          <span className="text-6xl">🔍</span>
          <p className="text-gray-500 mt-4">
            Enter an address above to start analyzing
          </p>
        </div>
      )}
    </div>
  )
}

function AddressInfoDisplay({ data }: { data: AddressInfo }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-500">Address</label>
        <p className="font-mono text-sm break-all">{data.address}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-500">Network</label>
          <p className="font-medium">{data.network}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Total Transactions</label>
          <p className="font-medium">{data.totalTxCount.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Sent</label>
          <p className="font-medium">{data.sentTxCount.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Received</label>
          <p className="font-medium">{data.receivedTxCount.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">First Seen</label>
          <p className="font-medium">{new Date(data.firstSeen).toLocaleDateString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Last Seen</label>
          <p className="font-medium">{new Date(data.lastSeen).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}

function RiskScoreDisplay({ data }: { data: RiskScore }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl font-bold text-gray-900">
          {data.riskScore.toFixed(1)}
        </div>
        <div className="mt-2">
          <RiskBadge level={data.riskLevel} size="lg" />
        </div>
      </div>

      {data.factors && data.factors.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Factors</h4>
          <div className="space-y-2">
            {data.factors
              .filter((f) => f.triggered)
              .map((factor, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">{factor.name}</span>
                  <span className="font-medium">{factor.score.toFixed(1)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {data.tags && data.tags.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatsDisplay({ data }: { data: AddressStats }) {
  const formatValue = (value: string) => {
    const num = parseFloat(value)
    if (num >= 1e18) return `${(num / 1e18).toFixed(4)} ETH`
    return value
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div>
        <label className="text-sm text-gray-500">Total Sent</label>
        <p className="font-medium">{formatValue(data.totalValueSent)}</p>
      </div>
      <div>
        <label className="text-sm text-gray-500">Total Received</label>
        <p className="font-medium">{formatValue(data.totalValueReceived)}</p>
      </div>
      <div>
        <label className="text-sm text-gray-500">Avg Transaction</label>
        <p className="font-medium">{formatValue(data.avgTxValue)}</p>
      </div>
      <div>
        <label className="text-sm text-gray-500">Max Transaction</label>
        <p className="font-medium">{formatValue(data.maxTxValue)}</p>
      </div>
      <div>
        <label className="text-sm text-gray-500">Min Transaction</label>
        <p className="font-medium">{formatValue(data.minTxValue)}</p>
      </div>
    </div>
  )
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="text-center py-4 text-red-500">
      <span className="text-2xl">❌</span>
      <p className="mt-2">{message}</p>
    </div>
  )
}
