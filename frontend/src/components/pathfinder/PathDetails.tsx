import { Tag } from "lucide-react"
import { Card } from "@/components/common"

interface PathNode {
  address: string
  riskScore?: number
  tags?: string[]
  value?: string
}

interface PathDetailsProps {
  path: PathNode[]
}

export function PathDetails({ path }: PathDetailsProps) {
  return (
    <Card title="Path Details">
      <div className="space-y-3">
        {path.map((node, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs font-medium">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs truncate">
                {node.address.slice(0, 10)}...{node.address.slice(-8)}
              </p>
            </div>
            {node.tags && node.tags.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {node.tags.slice(0, 2).map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {node.riskScore !== undefined && (
              <span
                className={`px-2 py-0.5 text-xs rounded ${
                  node.riskScore >= 0.6
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {node.riskScore.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
