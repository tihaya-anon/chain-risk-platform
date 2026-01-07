/**
 * Generated MSW Handlers - Re-exports
 */

// BFF Mock Handlers
export * from "./bff/addresses/addresses.msw"
export * from "./bff/auth/auth.msw"
export * from "./bff/graph/graph.msw"
export * from "./bff/risk/risk.msw"
export * from "./bff/transfers/transfers.msw"

// Orchestrator Mock Handlers
export * from "./orchestrator/admin-api/admin-api.msw"
export * from "./orchestrator/orchestration/orchestration.msw"

// Aggregate all handlers
import { getAddressesMock } from "./bff/addresses/addresses.msw"
import { getAuthMock } from "./bff/auth/auth.msw"
import { getGraphMock } from "./bff/graph/graph.msw"
import { getRiskMock } from "./bff/risk/risk.msw"
import { getTransfersMock } from "./bff/transfers/transfers.msw"
import { getAdminApiMock } from "./orchestrator/admin-api/admin-api.msw"
import { getOrchestrationMock } from "./orchestrator/orchestration/orchestration.msw"

export const getAllMockHandlers = () => [
  ...getAuthMock(),
  ...getAddressesMock(),
  ...getTransfersMock(),
  ...getRiskMock(),
  ...getGraphMock(),
  ...getOrchestrationMock(),
  ...getAdminApiMock(),
]
