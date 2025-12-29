import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

/**
 * Guard to extract user info from Gateway headers
 * This is a passive guard - it extracts user info if available
 * but doesn't block the request if headers are missing
 * (JWT guard will handle authentication in that case)
 */
@Injectable()
export class GatewayAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check if Gateway has injected user headers
    const userId = request.headers['x-user-id'];
    const username = request.headers['x-user-username'];
    const role = request.headers['x-user-role'];

    // If Gateway headers exist, use them (takes precedence over JWT)
    if (userId && username && role) {
      request.user = {
        sub: userId,
        username,
        role,
        fromGateway: true,
      };
    }

    // Always allow - JWT guard will handle auth if Gateway headers missing
    return true;
  }
}
