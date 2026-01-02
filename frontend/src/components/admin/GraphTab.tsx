import {
  Database,
  RefreshCw,
  Network,
  Clock,
  Play,
  Users,
  AlertTriangle,
  Zap,
  Tag,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { Button, Card } from "@/components/common"
import type { SyncStatusResponse } from "@/types"

interface GraphTabProps {
  syncStatus?: SyncStatusResponse
  isLoading: boolean
  triggerSync: any
  runClustering: any
  manualCluster: any
  propagateTags: any
  manualClusterAddresses: string
  setManualClusterAddresses: (value: string) => void
  handleManualCluster: () => void
}

export function GraphTab({
  syncStatus,
  isLoading,
  triggerSync,
  runClustering,
  manualCluster,
  propagateTags,
  manualClusterAddresses,
  setManualClusterAddresses,
  handleManualCluster,
}: GraphTabProps) {
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "RUNNING":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case "COMPLETED":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "FAILED":
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "RUNNING":
        return "bg-blue-100 text-blue-800"
      case "COMPLETED":
        return "bg-green-100 text-green-800"
      case "FAILED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return "-"
    return new Date(isoString).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sync Status Card */}
      <Card title="Data Synchronization" subtitle="PostgreSQL to Neo4j sync status">
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(syncStatus?.status)}
              <div>
                <p className="font-medium text-gray-900">Sync Status</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(syncStatus?.status)}`}
                >
                  {syncStatus?.status || "UNKNOWN"}
                </span>
              </div>
            </div>
            <Button
              onClick={() => triggerSync.mutate()}
              loading={triggerSync.isPending}
              disabled={syncStatus?.status === "RUNNING"}
            >
              <Play className="w-4 h-4 mr-2" />
              Trigger Sync
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium">Total Addresses</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {syncStatus?.totalAddresses?.toLocaleString() || "-"}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Network className="w-4 h-4" />
                <span className="text-sm font-medium">Total Transfers</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {syncStatus?.totalTransfers?.toLocaleString() || "-"}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">Last Synced Block</span>
              </div>
              <p className="text-2xl font-bold text-orange-900">
                {syncStatus?.lastSyncedBlock?.toLocaleString() || "-"}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Network</span>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {syncStatus?.network || "-"}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-500">Last Sync Time</span>
              <span className="font-medium">{formatTime(syncStatus?.lastSyncTime)}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-500">Next Scheduled Sync</span>
              <span className="font-medium">{formatTime(syncStatus?.nextSyncTime)}</span>
            </div>
          </div>

          {/* Error Message */}
          {syncStatus?.errorMessage && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Sync Error</p>
                <p className="text-sm text-red-700 mt-1">{syncStatus.errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Clustering Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto Clustering */}
        <Card
          title="Automatic Clustering"
          subtitle="Run clustering algorithm on all addresses"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Run the common-input heuristic clustering algorithm to automatically group
              related addresses. This process analyzes transaction patterns to identify
              addresses likely controlled by the same entity.
            </p>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Note</p>
                  <p>
                    This operation may take several minutes depending on the number of
                    addresses in the graph.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => runClustering.mutate()}
              loading={runClustering.isPending}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              Run Clustering Algorithm
            </Button>

            {runClustering.data && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">Clustering Complete</p>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>Clusters created: {runClustering.data.clustersCreated}</p>
                  <p>Addresses clustered: {runClustering.data.addressesClustered}</p>
                  <p>Duration: {runClustering.data.durationMs}ms</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Manual Clustering */}
        <Card
          title="Manual Clustering"
          subtitle="Group specific addresses into a cluster"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Manually create a cluster from a list of addresses. Enter one address per
              line or separate with commas.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Addresses (minimum 2)
              </label>
              <textarea
                value={manualClusterAddresses}
                onChange={(e) => setManualClusterAddresses(e.target.value)}
                placeholder="0x1234...&#10;0x5678...&#10;0xabcd..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <Button
              onClick={handleManualCluster}
              loading={manualCluster.isPending}
              disabled={!manualClusterAddresses.trim()}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              Create Cluster
            </Button>

            {manualCluster.data && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">Cluster Created</p>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>Clusters created: {manualCluster.data.clustersCreated}</p>
                  <p>Addresses clustered: {manualCluster.data.addressesClustered}</p>
                </div>
              </div>
            )}

            {manualCluster.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">
                  {(manualCluster.error as Error).message}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Tag Propagation */}
      <Card title="Tag Propagation" subtitle="Propagate risk tags through the graph">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Propagate risk tags from high-risk addresses to their neighbors. Tags are
            propagated with a decay factor, meaning neighbors receive a reduced risk score
            based on their distance from the source.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Max Hops</span>
              </div>
              <p className="text-xl font-bold text-gray-900">3</p>
              <p className="text-xs text-gray-500">Default propagation depth</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Decay Factor</span>
              </div>
              <p className="text-xl font-bold text-gray-900">0.5</p>
              <p className="text-xs text-gray-500">Risk reduction per hop</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Network className="w-4 h-4" />
                <span className="text-sm font-medium">Algorithm</span>
              </div>
              <p className="text-xl font-bold text-gray-900">BFS</p>
              <p className="text-xs text-gray-500">Breadth-first propagation</p>
            </div>
          </div>

          <Button
            onClick={() => propagateTags.mutate()}
            loading={propagateTags.isPending}
            variant="secondary"
            className="w-full"
          >
            <Zap className="w-4 h-4 mr-2" />
            Run Tag Propagation
          </Button>

          {propagateTags.data && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">Propagation Complete</p>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                <p>Addresses affected: {propagateTags.data.addressesAffected}</p>
                <p>Tags propagated: {propagateTags.data.tagsPropagated}</p>
                <p>Duration: {propagateTags.data.durationMs}ms</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
