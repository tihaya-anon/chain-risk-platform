import { Database, RefreshCw, Network, Clock, Play, Users, AlertTriangle, Zap, Loader2, CheckCircle, XCircle } from "lucide-react"
import { Button, Card } from "@/components/common"

interface GraphTabProps {
  syncStatus: unknown
  isLoading: boolean
  triggerSync: { mutate: () => void; isPending: boolean }
  runClustering: { mutate: () => void; isPending: boolean; data?: unknown }
  manualCluster: { mutate: (params: { data: { addresses: string[] } }) => void; isPending: boolean; data?: unknown }
  propagateTags: { mutate: () => void; isPending: boolean; data?: unknown }
  manualClusterAddresses: string
  setManualClusterAddresses: (value: string) => void
  handleManualCluster: () => void
}

export function GraphTab({ syncStatus, isLoading, triggerSync, runClustering, manualCluster, propagateTags, manualClusterAddresses, setManualClusterAddresses, handleManualCluster }: GraphTabProps) {
  const status = syncStatus as { status?: string; totalAddresses?: number; totalTransfers?: number; lastSyncedBlock?: number; network?: string; lastSyncTime?: string; nextSyncTime?: string; errorMessage?: string } | null
  const clusteringData = runClustering.data as { clustersCreated?: number; addressesClustered?: number; durationMs?: number } | undefined
  const propagationData = propagateTags.data as { addressesAffected?: number; tagsPropagated?: number; durationMs?: number } | undefined

  const getStatusIcon = (st?: string) => {
    switch (st) {
      case "RUNNING": return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case "COMPLETED": return <CheckCircle className="w-5 h-5 text-green-500" />
      case "FAILED": return <XCircle className="w-5 h-5 text-red-500" />
      default: return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (st?: string) => {
    switch (st) { case "RUNNING": return "bg-blue-100 text-blue-800"; case "COMPLETED": return "bg-green-100 text-green-800"; case "FAILED": return "bg-red-100 text-red-800"; default: return "bg-gray-100 text-gray-800" }
  }

  const formatTime = (isoString?: string) => isoString ? new Date(isoString).toLocaleString() : "-"

  if (isLoading) return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>

  return (
    <div className="space-y-6">
      <Card title="Data Synchronization" subtitle="PostgreSQL to Neo4j sync status">
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(status?.status)}
              <div><p className="font-medium text-gray-900">Sync Status</p><span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(status?.status)}`}>{status?.status || "UNKNOWN"}</span></div>
            </div>
            <Button onClick={() => triggerSync.mutate()} loading={triggerSync.isPending} disabled={status?.status === "RUNNING"}><Play className="w-4 h-4 mr-2" />Trigger Sync</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg"><div className="flex items-center gap-2 text-blue-600 mb-1"><Database className="w-4 h-4" /><span className="text-sm font-medium">Total Addresses</span></div><p className="text-2xl font-bold text-blue-900">{status?.totalAddresses?.toLocaleString() || "-"}</p></div>
            <div className="p-4 bg-purple-50 rounded-lg"><div className="flex items-center gap-2 text-purple-600 mb-1"><Network className="w-4 h-4" /><span className="text-sm font-medium">Total Transfers</span></div><p className="text-2xl font-bold text-purple-900">{status?.totalTransfers?.toLocaleString() || "-"}</p></div>
            <div className="p-4 bg-orange-50 rounded-lg"><div className="flex items-center gap-2 text-orange-600 mb-1"><RefreshCw className="w-4 h-4" /><span className="text-sm font-medium">Last Synced Block</span></div><p className="text-2xl font-bold text-orange-900">{status?.lastSyncedBlock?.toLocaleString() || "-"}</p></div>
            <div className="p-4 bg-green-50 rounded-lg"><div className="flex items-center gap-2 text-green-600 mb-1"><Clock className="w-4 h-4" /><span className="text-sm font-medium">Network</span></div><p className="text-2xl font-bold text-green-900">{status?.network || "-"}</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between p-3 bg-gray-50 rounded"><span className="text-gray-500">Last Sync Time</span><span className="font-medium">{formatTime(status?.lastSyncTime)}</span></div>
            <div className="flex justify-between p-3 bg-gray-50 rounded"><span className="text-gray-500">Next Scheduled Sync</span><span className="font-medium">{formatTime(status?.nextSyncTime)}</span></div>
          </div>
          {status?.errorMessage && (<div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" /><div><p className="font-medium text-red-800">Sync Error</p><p className="text-sm text-red-700 mt-1">{status.errorMessage}</p></div></div>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Automatic Clustering" subtitle="Run clustering algorithm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Run the common-input heuristic clustering algorithm to automatically group related addresses.</p>
            <Button onClick={() => runClustering.mutate()} loading={runClustering.isPending} className="w-full"><Users className="w-4 h-4 mr-2" />Run Clustering Algorithm</Button>
            {clusteringData && (<div className="p-4 bg-green-50 border border-green-200 rounded-lg"><p className="font-medium text-green-800">Clustering Complete</p><div className="mt-2 text-sm text-green-700 space-y-1"><p>Clusters created: {clusteringData.clustersCreated}</p><p>Addresses clustered: {clusteringData.addressesClustered}</p><p>Duration: {clusteringData.durationMs}ms</p></div></div>)}
          </div>
        </Card>

        <Card title="Manual Clustering" subtitle="Group specific addresses">
          <div className="space-y-4">
            <textarea value={manualClusterAddresses} onChange={(e) => setManualClusterAddresses(e.target.value)} placeholder="0x1234...&#10;0x5678..." className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
            <Button onClick={handleManualCluster} loading={manualCluster.isPending} disabled={!manualClusterAddresses.trim()} className="w-full"><Users className="w-4 h-4 mr-2" />Create Cluster</Button>
          </div>
        </Card>
      </div>

      <Card title="Tag Propagation" subtitle="Propagate risk tags through the graph">
        <div className="space-y-4">
          <Button onClick={() => propagateTags.mutate()} loading={propagateTags.isPending} variant="secondary" className="w-full"><Zap className="w-4 h-4 mr-2" />Run Tag Propagation</Button>
          {propagationData && (<div className="p-4 bg-green-50 border border-green-200 rounded-lg"><p className="font-medium text-green-800">Propagation Complete</p><div className="mt-2 text-sm text-green-700 space-y-1"><p>Addresses affected: {propagationData.addressesAffected}</p><p>Tags propagated: {propagationData.tagsPropagated}</p><p>Duration: {propagationData.durationMs}ms</p></div></div>)}
        </div>
      </Card>
    </div>
  )
}
