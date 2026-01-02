import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extract user info from Gateway-injected headers
 * Gateway will add these headers after authentication:
 * - X-User-Id: User ID
 * - X-User-Username: Username
 * - X-User-Role: User role
 */
export const GatewayUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Extract user info from Gateway headers
    const userId = request.headers["x-user-id"];
    const username = request.headers["x-user-username"];
    const role = request.headers["x-user-role"];

    if (!userId || !username || !role) {
      return null;
    }

    return {
      sub: userId,
      username,
      role,
    };
  },
);
