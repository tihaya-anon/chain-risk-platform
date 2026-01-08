import { Card } from "@/components/common"
import type { RiskProperties, PipelineProperties } from "@/api/generated"

interface ConfigTabProps {
  riskConfig?: RiskProperties
  pipelineConfig?: PipelineProperties
  isLoadingRisk: boolean
  isLoadingPipeline: boolean
}

export function ConfigTab({
  riskConfig,
  pipelineConfig,
  isLoadingRisk,
  isLoadingPipeline,
}: ConfigTabProps) {
  return (
    <div className="space-y-6">
      <Card title="Risk Configuration" subtitle="Risk scoring thresholds and settings">
        {isLoadingRisk ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">
                  High Threshold
                </p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {riskConfig?.highThreshold || "-"}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
                  Medium Threshold
                </p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {riskConfig?.mediumThreshold || "-"}
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                  Cache TTL
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {riskConfig?.cacheTtlSeconds || "-"}s
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Pipeline Configuration" subtitle="Data pipeline settings">
        {isLoadingPipeline ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Ingestion</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Network</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.ingestion?.network || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Interval</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.ingestion?.polling?.intervalMs || "-"}ms
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Batch Size</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.ingestion?.polling?.batchSize || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Rate Limit</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.ingestion?.rateLimit?.requestsPerSecond || "-"}/s
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Stream Processor
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Parallelism</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.streamProcessor?.parallelism || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Checkpoint Interval</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.streamProcessor?.checkpoint?.intervalMs || "-"}ms
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Max Poll Records</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.streamProcessor?.consumer?.maxPollRecords || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Clustering</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Min Cluster Size</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.clustering?.minClusterSize || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Max Depth</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.clustering?.maxDepth || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Propagation</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Max Hops</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.propagation?.maxHops || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Decay Factor</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.propagation?.decayFactor || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <p className="text-gray-600 dark:text-gray-400">Min Threshold</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {pipelineConfig?.propagation?.minThreshold || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
