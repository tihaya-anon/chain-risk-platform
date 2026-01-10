import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Decorator to specify required roles for an endpoint.
 * Use with RolesGuard to enforce RBAC.
 *
 * @example
 * @Roles('admin')
 * @UseGuards(GatewayAuthGuard, RolesGuard)
 * async adminOnlyEndpoint() {}
 *
 * @example
 * @Roles('admin', 'analyst')
 * @UseGuards(GatewayAuthGuard, RolesGuard)
 * async adminOrAnalystEndpoint() {}
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
