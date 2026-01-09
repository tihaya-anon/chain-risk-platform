/**
 * Unified color palette for the application.
 * All color definitions should be imported from here to ensure consistency.
 */

// =============================================================================
// Severity/Level Colors (Critical → Low)
// Used for risk scores, alert severity, and any level-based indicators
// =============================================================================

export const SEVERITY_COLORS = {
  critical: {
    hex: "#EF4444",
    hexLight: "#F87171",
    border: "#B91C1C",
    bg: "bg-red-100 dark:bg-red-900/30",
    bgSolid: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    textDark: "text-red-800 dark:text-red-300",
    borderTw: "border-red-200 dark:border-red-800",
  },
  high: {
    hex: "#F97316",
    hexLight: "#FB923C",
    border: "#C2410C",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    bgSolid: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    textDark: "text-orange-800 dark:text-orange-300",
    borderTw: "border-orange-200 dark:border-orange-800",
  },
  medium: {
    hex: "#FBBF24",
    hexLight: "#FCD34D",
    border: "#A16207",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    bgSolid: "bg-yellow-500",
    text: "text-yellow-600 dark:text-yellow-400",
    textDark: "text-yellow-800 dark:text-yellow-300",
    borderTw: "border-yellow-200 dark:border-yellow-800",
  },
  low: {
    hex: "#10B981",
    hexLight: "#34D399",
    border: "#047857",
    bg: "bg-green-100 dark:bg-green-900/30",
    bgSolid: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
    textDark: "text-green-800 dark:text-green-300",
    borderTw: "border-green-200 dark:border-green-800",
  },
  unknown: {
    hex: "#6B7280",
    hexLight: "#9CA3AF",
    border: "#374151",
    bg: "bg-gray-100 dark:bg-gray-800",
    bgSolid: "bg-gray-500",
    text: "text-gray-600 dark:text-gray-400",
    textDark: "text-gray-800 dark:text-gray-300",
    borderTw: "border-gray-200 dark:border-gray-700",
  },
  // Info level (for neutral indicators like "total", "avg")
  info: {
    hex: "#3B82F6",
    hexLight: "#60A5FA",
    border: "#1D4ED8",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    bgSolid: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    textDark: "text-blue-800 dark:text-blue-300",
    borderTw: "border-blue-200 dark:border-blue-800",
  },
} as const

export type SeverityLevel = keyof typeof SEVERITY_COLORS

// Legacy alias
export type RiskLevel = Exclude<SeverityLevel, "info">
export const RISK_COLORS = SEVERITY_COLORS

// =============================================================================
// Direction Colors
// =============================================================================

export const DIRECTION_COLORS = {
  incoming: {
    hex: "#3B82F6",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    bgSolid: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    textDark: "text-blue-700 dark:text-blue-300",
  },
  outgoing: {
    hex: "#F97316",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    bgSolid: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    textDark: "text-orange-700 dark:text-orange-300",
  },
  both: {
    hex: "#8B5CF6",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    bgSolid: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
    textDark: "text-purple-700 dark:text-purple-300",
  },
  indirect: {
    hex: "#6B7280",
    bg: "bg-gray-100 dark:bg-gray-800",
    bgSolid: "bg-gray-500",
    text: "text-gray-600 dark:text-gray-400",
    textDark: "text-gray-700 dark:text-gray-300",
  },
} as const

export type Direction = keyof typeof DIRECTION_COLORS

// =============================================================================
// Special Node Colors
// =============================================================================

export const NODE_COLORS = {
  center: { hex: "#3B82F6", border: "#1E40AF" },
  source: { hex: "#3B82F6" },
  target: { hex: "#8B5CF6" },
} as const

// =============================================================================
// Utility Functions
// =============================================================================

export function scoreToRiskLevel(score?: number): RiskLevel {
  if (score === undefined) return "unknown"
  if (score >= 0.8) return "critical"
  if (score >= 0.6) return "high"
  if (score >= 0.4) return "medium"
  return "low"
}

export function getRiskHex(score?: number): string {
  return SEVERITY_COLORS[scoreToRiskLevel(score)].hex
}

export function getRiskHexLight(score?: number): string {
  return SEVERITY_COLORS[scoreToRiskLevel(score)].hexLight
}

export function getRiskBorderHex(score?: number): string {
  return SEVERITY_COLORS[scoreToRiskLevel(score)].border
}

export function getRiskBadgeClasses(score?: number): string {
  const colors = SEVERITY_COLORS[scoreToRiskLevel(score)]
  return `${colors.bg} ${colors.textDark} ${colors.borderTw}`
}

export function getRiskDotClass(score?: number): string {
  return SEVERITY_COLORS[scoreToRiskLevel(score)].bgSolid
}

export function getRiskTextClass(score?: number): string {
  return SEVERITY_COLORS[scoreToRiskLevel(score)].text
}

export function getDirectionHex(direction?: Direction): string {
  return DIRECTION_COLORS[direction || "indirect"].hex
}

export function getDirectionBadgeClasses(direction?: Direction): string {
  const colors = DIRECTION_COLORS[direction || "indirect"]
  return `${colors.bg} ${colors.textDark}`
}

// =============================================================================
// Legacy exports
// =============================================================================

/** @deprecated Use DIRECTION_COLORS instead */
export const EDGE_COLORS = {
  incoming: DIRECTION_COLORS.incoming.hex,
  outgoing: DIRECTION_COLORS.outgoing.hex,
  both: DIRECTION_COLORS.both.hex,
  indirect: DIRECTION_COLORS.indirect.hex,
} as const
