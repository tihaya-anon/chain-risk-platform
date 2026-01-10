import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { getLogger } from "../logger";

const logger = getLogger("RolesGuard");

/**
 * Role definitions for the Chain Risk Platform
 */
export const ROLE_HIERARCHY: Record<string, string[]> = {
  admin: ["admin", "analyst", "user"],
  analyst: ["analyst", "user"],
  user: ["user"],
};

/**
 * RBAC Guard for role-based access control.
 *
 * Must be used AFTER GatewayAuthGuard or JwtAuthGuard to ensure
 * request.user is populated.
 *
 * @example
 * @Roles('admin')
 * @UseGuards(GatewayAuthGuard, RolesGuard)
 * async adminEndpoint() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      logger.warn("RBAC check failed: no user in request");
      throw new ForbiddenException("Access denied: user not authenticated");
    }

    const userRole = user.role;
    if (!userRole) {
      logger.warn("RBAC check failed: user has no role", { userId: user.sub });
      throw new ForbiddenException("Access denied: user has no role assigned");
    }

    // Get effective roles from hierarchy
    const effectiveRoles = ROLE_HIERARCHY[userRole] || [userRole];

    // Check if user has any required role
    const hasRole = requiredRoles.some((role) => effectiveRoles.includes(role));

    if (!hasRole) {
      logger.warn("RBAC check failed: insufficient permissions", {
        userId: user.sub,
        userRole,
        requiredRoles,
      });
      throw new ForbiddenException(
        `Access denied: requires one of roles [${requiredRoles.join(", ")}]`,
      );
    }

    logger.debug("RBAC check passed", {
      userId: user.sub,
      userRole,
      requiredRoles,
    });

    return true;
  }
}
