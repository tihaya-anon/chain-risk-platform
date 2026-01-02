import { Server } from "lucide-react"
import { Card } from "@/components/common"
import type { ServiceInfo } from "@/types"

interface ServicesTabProps {
  services: ServiceInfo[]
  isLoading: boolean
}

export function ServicesTab({ services, isLoading }: ServicesTabProps) {
  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card title="Registered Services" subtitle="All services in the system">
        <div className="space-y-4">
          {services.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No services found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-purple-600" />
                      <h3 className="font-medium text-gray-900">{service.name}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        service.healthyInstanceCount === service.instanceCount
                          ? "bg-green-100 text-green-800"
                          : service.healthyInstanceCount > 0
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {service.healthyInstanceCount}/{service.instanceCount}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Group</span>
                      <span className="font-medium text-gray-900">{service.groupName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Clusters</span>
                      <span className="font-medium text-gray-900">
                        {service.clusterCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Instances</span>
                      <span className="font-medium text-gray-900">
                        {service.instanceCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
