import { Tag } from "lucide-react"
import { Card, RiskBadge } from "@/components/common"

interface RiskInfo {
  riskScore: number
  riskLevel: string
  tags?: string[]
}

interface AddressRiskCardProps {
  title: string
  risk: RiskInfo | { error: string }
}

export function AddressRiskCard({ title, risk }: AddressRiskCardProps) {
  return (
    <Card title={title}>
      {"error" in risk ? (
        <p className="text-gray-500 text-sm">Risk data unavailable</p>
      ) : (
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-3xl font-bold">{risk.riskScore.toFixed(2)}</div>
            <RiskBadge level={risk.riskLevel as "low" | "medium" | "high" | "critical"} />
          </div>
          {risk.tags && risk.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center">
              {risk.tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
