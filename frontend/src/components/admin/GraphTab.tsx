import { Users, Zap } from "lucide-react"
import { Button, Card } from "@/components/common"

interface GraphTabProps {
  runClustering: { mutate: () => void; isPending: boolean; data?: unknown }
  manualCluster: {
    mutate: (params: { data: { addresses: string[] } }) => void
    isPending: boolean
    data?: unknown
  }
  propagateTags: { mutate: () => void; isPending: boolean; data?: unknown }
  manualClusterAddresses: string
  setManualClusterAddresses: (value: string) => void
  handleManualCluster: () => void
}

export function GraphTab({
  runClustering,
  manualCluster,
  propagateTags,
  manualClusterAddresses,
  setManualClusterAddresses,
  handleManualCluster,
}: GraphTabProps) {
  const clusteringData = runClustering.data as
    | { clustersCreated?: number; addressesClustered?: number; durationMs?: number }
    | undefined
  const propagationData = propagateTags.data as
    | { addressesAffected?: number; tagsPropagated?: number; durationMs?: number }
    | undefined

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Automatic Clustering" subtitle="Run clustering algorithm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Run the common-input heuristic clustering algorithm to automatically group
              related addresses.
            </p>
            <Button
              onClick={() => runClustering.mutate()}
              loading={runClustering.isPending}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              Run Clustering Algorithm
            </Button>
            {clusteringData && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">Clustering Complete</p>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>Clusters created: {clusteringData.clustersCreated}</p>
                  <p>Addresses clustered: {clusteringData.addressesClustered}</p>
                  <p>Duration: {clusteringData.durationMs}ms</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Manual Clustering" subtitle="Group specific addresses">
          <div className="space-y-4">
            <textarea
              value={manualClusterAddresses}
              onChange={(e) => setManualClusterAddresses(e.target.value)}
              placeholder="0x1234...&#10;0x5678..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleManualCluster}
              loading={manualCluster.isPending}
              disabled={!manualClusterAddresses.trim()}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              Create Cluster
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Tag Propagation" subtitle="Propagate risk tags through the graph">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Propagate risk tags from high-risk addresses to their neighbors based on
            transaction relationships.
          </p>
          <Button
            onClick={() => propagateTags.mutate()}
            loading={propagateTags.isPending}
            variant="secondary"
            className="w-full"
          >
            <Zap className="w-4 h-4 mr-2" />
            Run Tag Propagation
          </Button>
          {propagationData && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">Propagation Complete</p>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                <p>Addresses affected: {propagationData.addressesAffected}</p>
                <p>Tags propagated: {propagationData.tagsPropagated}</p>
                <p>Duration: {propagationData.durationMs}ms</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
