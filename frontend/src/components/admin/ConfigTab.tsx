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
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 font-medium mb-1">High Threshold</p>
                <p className="text-2xl font-bold text-red-900">
                  {riskConfig?.highThreshold || "-"}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-600 font-medium mb-1">
                  Medium Threshold
                </p>
                <p className="text-2xl font-bold text-yellow-900">
                  {riskConfig?.mediumThreshold || "-"}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium mb-1">Cache TTL</p>
                <p className="text-2xl font-bold text-blue-900">
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
              <h4 className="font-medium text-gray-900 mb-3">Ingestion</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Network</p>
                  <p className="font-medium">
                    {pipelineConfig?.ingestion?.network || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Interval</p>
                  <p className="font-medium">
                    {pipelineConfig?.ingestion?.polling?.intervalMs || "-"}ms
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Batch Size</p>
                  <p className="font-medium">
                    {pipelineConfig?.ingestion?.polling?.batchSize || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Rate Limit</p>
                  <p className="font-medium">
                    {pipelineConfig?.ingestion?.rateLimit?.requestsPerSecond || "-"}/s
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Stream Processor</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Parallelism</p>
                  <p className="font-medium">
                    {pipelineConfig?.streamProcessor?.parallelism || "-"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Checkpoint Interval</p>
                  <p className="font-medium">
                    {pipelineConfig?.streamProcessor?.checkpoint?.intervalMs || "-"}ms
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Max Poll Records</p>
                  <p className="font-medium">
                    {pipelineConfig?.streamProcessor?.consumer?.maxPollRecords || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Graph Sync</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Interval</p>
                  <p className="font-medium">
                    {pipelineConfig?.graphSync?.intervalMs || "-"}ms
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600">Batch Size</p>
                  <p className="font-medium">
                    {pipelineConfig?.graphSync?.batchSize || "-"}
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
