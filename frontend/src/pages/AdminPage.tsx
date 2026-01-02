import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Settings, Activity, Network, Server, FileCode } from "lucide-react"
import { graphService, adminService } from "@/services"
import { PipelineTab, GraphTab, ServicesTab, ConfigTab } from "@/components/admin"

type TabType = "pipeline" | "graph" | "services" | "config"

export function AdminPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("pipeline")
  const [manualClusterAddresses, setManualClusterAddresses] = useState("")

  // ============== Queries ==============

  // Graph sync status
  const syncStatusQuery = useQuery({
    queryKey: ["adminSyncStatus"],
    queryFn: () => graphService.getSyncStatus(),
    refetchInterval: 5000,
  })

  // Pipeline status
  const pipelineStatusQuery = useQuery({
    queryKey: ["adminPipelineStatus"],
    queryFn: () => adminService.getPipelineStatus(),
    refetchInterval: 5000,
  })

  // Services list
  const servicesQuery = useQuery({
    queryKey: ["adminServices"],
    queryFn: () => adminService.getServices(),
    refetchInterval: 10000,
  })

  // Risk config
  const riskConfigQuery = useQuery({
    queryKey: ["adminRiskConfig"],
    queryFn: () => adminService.getRiskConfig(),
  })

  // Pipeline config
  const pipelineConfigQuery = useQuery({
    queryKey: ["adminPipelineConfig"],
    queryFn: () => adminService.getPipelineConfig(),
  })

  // ============== Mutations ==============

  // Graph operations
  const triggerSyncMutation = useMutation({
    mutationFn: () => graphService.triggerSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSyncStatus"] })
    },
  })

  const runClusteringMutation = useMutation({
    mutationFn: () => graphService.runClustering(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSyncStatus"] })
    },
  })

  const manualClusterMutation = useMutation({
    mutationFn: (addresses: string[]) => graphService.manualCluster(addresses),
    onSuccess: () => {
      setManualClusterAddresses("")
      queryClient.invalidateQueries({ queryKey: ["adminSyncStatus"] })
    },
  })

  const propagateTagsMutation = useMutation({
    mutationFn: () => graphService.propagateTags(),
  })

  // Pipeline control mutations
  const controlIngestionMutation = useMutation({
    mutationFn: (action: "pause" | "resume" | "trigger") =>
      adminService.controlIngestion(action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPipelineStatus"] })
    },
  })

  const controlGraphSyncMutation = useMutation({
    mutationFn: (action: "pause" | "resume" | "trigger") =>
      adminService.controlGraphSync(action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPipelineStatus"] })
    },
  })

  // ============== Helper Functions ==============

  const handleManualCluster = () => {
    const addresses = manualClusterAddresses
      .split(/[\n,]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.startsWith("0x") && a.length === 42)

    if (addresses.length < 2) {
      alert("Please enter at least 2 valid Ethereum addresses")
      return
    }

    manualClusterMutation.mutate(addresses)
  }

  // ============== Tab Configuration ==============

  const tabs = [
    { id: "pipeline" as TabType, label: "Pipeline", icon: Activity },
    { id: "graph" as TabType, label: "Graph Operations", icon: Network },
    { id: "services" as TabType, label: "Services", icon: Server },
    { id: "config" as TabType, label: "Configuration", icon: FileCode },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            Admin Panel
          </h1>
          <p className="text-gray-600 mt-1">
            Manage pipeline, services, and system configuration
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? "border-purple-500 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "pipeline" && (
          <PipelineTab
            pipelineStatus={pipelineStatusQuery.data}
            isLoading={pipelineStatusQuery.isLoading}
            controlIngestion={controlIngestionMutation}
            controlGraphSync={controlGraphSyncMutation}
          />
        )}

        {activeTab === "graph" && (
          <GraphTab
            syncStatus={syncStatusQuery.data}
            isLoading={syncStatusQuery.isLoading}
            triggerSync={triggerSyncMutation}
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
