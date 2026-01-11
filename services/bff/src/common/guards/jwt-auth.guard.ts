import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { loadJwtConfig } from "../../config/config";
import { getLogger } from "../logger";

const logger = getLogger("JwtAuthGuard");

/**
 * JWT Authentication Guard
 *
 * Validates JWT tokens directly (for endpoints without Gateway).
 * Use this for internal testing or when Gateway is not in path.
 *
 * For production, prefer GatewayAuthGuard which trusts Gateway headers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwtSecret: string | null = null;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get token from Authorization header
    const authHeader = request.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header");
    }

    const token = authHeader.substring(7);

    // Load JWT config if not cached
    if (!this.jwtSecret) {
      const config = await loadJwtConfig();
      this.jwtSecret = config.secret;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        sub: string;
        username: string;
        role: string;
      };

      // Attach user info to request
      request.user = {
        sub: decoded.sub,
        username: decoded.username,
        role: decoded.role,
      };

      logger.debug("JWT validated", { userId: decoded.sub });
      return true;
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new UnauthorizedException("Token expired");
      }
      logger.warn("JWT validation failed", { error: error.message });
      throw new UnauthorizedException("Invalid token");
    }
  }
}
