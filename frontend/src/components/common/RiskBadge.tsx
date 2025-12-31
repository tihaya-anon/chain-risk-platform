import { clsx } from "clsx"
import type { RiskLevel } from "@/types"

interface RiskBadgeProps {
  level: RiskLevel
  score?: number
  size?: "sm" | "md" | "lg"
}

const levelStyles: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
}

const levelLabels: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
}

export function RiskBadge({ level, score, size = "md" }: RiskBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full border",
        levelStyles[level],
        sizeStyles[size]
      )}
    >
      {levelLabels[level]}
      {score !== undefined && (
        <span className="ml-1 opacity-75">({score.toFixed(1)})</span>
      )}
    </span>
  )
}
