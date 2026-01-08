import { Play, Pause, AlertTriangle } from "lucide-react"
import { Button, Card } from "@/components/common"
import type { PipelineStatus } from "@/api/generated"

interface PipelineTabProps {
  pipelineStatus?: PipelineStatus
  isLoading: boolean
  controlIngestion: { mutate: (action: string) => void; isPending: boolean }
}

export function PipelineTab({
  pipelineStatus,
  isLoading,
  controlIngestion,
}: PipelineTabProps) {
  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card title="Data Ingestion" subtitle="Blockchain data ingestion from Ethereum">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                    pipelineStatus?.ingestion?.status === "RUNNING"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300"
                  }`}
                >
                  {pipelineStatus?.ingestion?.enabled ? "Enabled" : "Disabled"}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                    pipelineStatus?.ingestion?.status === "RUNNING"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300"
                  }`}
                >
                  {pipelineStatus?.ingestion?.status || "IDLE"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => controlIngestion.mutate("pause")}
                loading={controlIngestion.isPending}
                disabled={pipelineStatus?.ingestion?.status !== "RUNNING"}
              >
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                onClick={() => controlIngestion.mutate("resume")}
                loading={controlIngestion.isPending}
                disabled={pipelineStatus?.ingestion?.status === "RUNNING"}
              >
                <Play className="w-4 h-4 mr-1" />
                Resume
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Last Block
              </p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                {pipelineStatus?.ingestion?.lastBlock?.toLocaleString() || "-"}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                Processed Count
              </p>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                {pipelineStatus?.streamProcessor?.processedCount?.toLocaleString() || "-"}
              </p>
            </div>
          </div>

          {pipelineStatus?.ingestion?.errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300 text-sm">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400">
                  {pipelineStatus.ingestion.errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Clustering" subtitle="Address clustering status">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Enabled</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {pipelineStatus?.clustering?.enabled ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Last Run</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {pipelineStatus?.clustering?.lastRunTime
                  ? new Date(pipelineStatus.clustering.lastRunTime).toLocaleString()
                  : "-"}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Propagation" subtitle="Risk tag propagation status">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Enabled</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {pipelineStatus?.propagation?.enabled ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Last Run</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {pipelineStatus?.propagation?.lastRunTime
                  ? new Date(pipelineStatus.propagation.lastRunTime).toLocaleString()
                  : "-"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
