import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

/**
 * Gateway Authentication Guard
 *
 * BFF completely trusts Gateway for authentication.
 * This guard ensures requests come from Gateway with user context headers.
 *
 * Gateway must provide:
 * - X-User-Id: User ID
 * - X-User-Username: Username
 * - X-User-Role: User role
 */
@Injectable()
export class GatewayAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract user info from Gateway headers
    const userId = request.headers["x-user-id"];
    const username = request.headers["x-user-username"];
    const role = request.headers["x-user-role"];

    // All three headers are required
    if (!userId || !username || !role) {
      throw new UnauthorizedException(
        "Missing Gateway authentication headers. Requests must come through Gateway.",
      );
    }

    // Attach user info to request
    request.user = {
      sub: userId,
      username,
      role,
    };

    return true;
  }
}
