import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Settings, Activity, Network, Server, FileCode } from "lucide-react"
import {
  useGetPipelineStatus,
  useGetServices,
  useGetRiskConfig,
  useGetPipelineConfig,
  useControlIngestion,
  useGraphControllerRunClustering,
  useGraphControllerManualCluster,
  useGraphControllerPropagateTags,
} from "@/api/generated"
import { PipelineTab, GraphTab, ServicesTab, ConfigTab } from "@/components/admin"

type TabType = "pipeline" | "graph" | "services" | "config"

export function AdminPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("pipeline")
  const [manualClusterAddresses, setManualClusterAddresses] = useState("")

  const pipelineStatusQuery = useGetPipelineStatus({ query: { refetchInterval: 5000 } })
  const servicesQuery = useGetServices({ query: { refetchInterval: 10000 } })
  const riskConfigQuery = useGetRiskConfig()
  const pipelineConfigQuery = useGetPipelineConfig()

  const runClusteringMutation = useGraphControllerRunClustering({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminSyncStatus"] }),
    },
  })

  const manualClusterMutation = useGraphControllerManualCluster({
    mutation: {
      onSuccess: () => {
        setManualClusterAddresses("")
        queryClient.invalidateQueries({ queryKey: ["adminSyncStatus"] })
      },
    },
  })

  const propagateTagsMutation = useGraphControllerPropagateTags()

  const controlIngestionMutation = useControlIngestion({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ["/api/admin/pipeline/status"] }),
    },
  })

  const handleManualCluster = () => {
    const addresses = manualClusterAddresses
      .split(/[\n,]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.startsWith("0x") && a.length === 42)
    if (addresses.length < 2) {
      alert("Please enter at least 2 valid Ethereum addresses")
      return
    }
    manualClusterMutation.mutate({ data: { addresses } })
  }

  const tabs = [
    { id: "pipeline" as TabType, label: "Pipeline", icon: Activity },
    { id: "graph" as TabType, label: "Graph Operations", icon: Network },
    { id: "services" as TabType, label: "Services", icon: Server },
    { id: "config" as TabType, label: "Configuration", icon: FileCode },
  ]

  // Wrapper function for ingestion control
  const ingestionWrapper = {
    mutate: (action: string) =>
      controlIngestionMutation.mutate({
        action: action as "pause" | "resume",
      }),
    isPending: controlIngestionMutation.isPending,
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            Admin Panel
          </h1>
          <p className="text-gray-600 mt-1">
            Manage pipeline, services, and system configuration
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${isActive ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {activeTab === "pipeline" && (
          <PipelineTab
            pipelineStatus={pipelineStatusQuery.data}
            isLoading={pipelineStatusQuery.isLoading}
            controlIngestion={ingestionWrapper}
          />
        )}

        {activeTab === "graph" && (
          <GraphTab
            runClustering={runClusteringMutation}
            manualCluster={manualClusterMutation}
            propagateTags={propagateTagsMutation}
            manualClusterAddresses={manualClusterAddresses}
            setManualClusterAddresses={setManualClusterAddresses}
            handleManualCluster={handleManualCluster}
          />
        )}

        {activeTab === "services" && (
          <ServicesTab
            services={servicesQuery.data || []}
            isLoading={servicesQuery.isLoading}
          />
        )}
        {activeTab === "config" && (
          <ConfigTab
            riskConfig={riskConfigQuery.data}
            pipelineConfig={pipelineConfigQuery.data}
            isLoadingRisk={riskConfigQuery.isLoading}
            isLoadingPipeline={pipelineConfigQuery.isLoading}
          />
        )}
      </div>
    </div>
  )
}
