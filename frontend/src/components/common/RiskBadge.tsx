import { clsx } from "clsx"
import type { RiskScoreResponseRiskLevel } from "@/api/generated"
import { RISK_COLORS, scoreToRiskLevel, type RiskLevel } from "@/lib/palette"

type RiskLevelInput = RiskScoreResponseRiskLevel | RiskLevel

interface RiskBadgeProps {
  level?: RiskLevelInput
  score?: number
  size?: "sm" | "md" | "lg"
}

const levelStyles: Record<RiskLevel, string> = {
  low: `${RISK_COLORS.low.bg} ${RISK_COLORS.low.textDark} ${RISK_COLORS.low.borderTw}`,
  medium: `${RISK_COLORS.medium.bg} ${RISK_COLORS.medium.textDark} ${RISK_COLORS.medium.borderTw}`,
  high: `${RISK_COLORS.high.bg} ${RISK_COLORS.high.textDark} ${RISK_COLORS.high.borderTw}`,
  critical: `${RISK_COLORS.critical.bg} ${RISK_COLORS.critical.textDark} ${RISK_COLORS.critical.borderTw}`,
  unknown: `${RISK_COLORS.unknown.bg} ${RISK_COLORS.unknown.textDark} ${RISK_COLORS.unknown.borderTw}`,
}

const levelLabels: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  unknown: "Unknown",
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
}

export function RiskBadge({ level, score, size = "md" }: RiskBadgeProps) {
  const resolvedLevel: RiskLevel =
    level !== undefined ? (level as RiskLevel) : scoreToRiskLevel(score)

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full border",
        levelStyles[resolvedLevel] || levelStyles.unknown,
        sizeStyles[size]
      )}
    >
      {levelLabels[resolvedLevel] || "Unknown"}
      {score !== undefined && (
        <span className="ml-1 opacity-75">({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  )
}
