import { Injectable, UnauthorizedException, OnModuleInit } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import {
  LoginDto,
  LoginResponse,
  UserPayload,
  UserProfileResponse,
  RefreshTokenDto,
  RefreshTokenResponse,
} from "./auth.dto";
import { getLogger } from "../../common/logger";
import { loadJwtConfig, JwtConfig } from "../../config/config";

const logger = getLogger("AuthService");

// Demo users - in production, use a database
const DEMO_USERS = [
  { id: "1", username: "admin", password: "admin123", role: "admin" },
  { id: "2", username: "user", password: "user123", role: "user" },
  { id: "3", username: "analyst", password: "analyst123", role: "analyst" },
];

@Injectable()
export class AuthService implements OnModuleInit {
  private jwtConfig: JwtConfig | null = null;

  async onModuleInit(): Promise<void> {
    this.jwtConfig = await loadJwtConfig();
    logger.info("JWT config loaded", {
      expiresIn: this.jwtConfig.expiresIn,
      refreshExpiresIn: this.jwtConfig.refreshExpiresIn,
    });
  }

  private getJwtConfig(): JwtConfig {
    if (!this.jwtConfig) {
      throw new Error("JWT config not initialized");
    }
    return this.jwtConfig;
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = DEMO_USERS.find(
      (u) => u.username === dto.username && u.password === dto.password,
    );

    if (!user) {
      logger.warn("Login failed", { username: dto.username });
      throw new UnauthorizedException("Invalid credentials");
    }

    const config = this.getJwtConfig();
    const payload: UserPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    // Generate access token
    const accessToken = jwt.sign(payload, config.secret, {
      expiresIn: config.expiresIn,
    } as jwt.SignOptions);

    // Generate refresh token
    const refreshPayload = { sub: user.id, type: "refresh" };
    const refreshToken = jwt.sign(refreshPayload, config.secret, {
      expiresIn: config.refreshExpiresIn,
    } as jwt.SignOptions);

    logger.info("Login successful", {
      username: user.username,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: config.expiresIn,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponse> {
    const config = this.getJwtConfig();

    try {
      const decoded = jwt.verify(dto.refreshToken, config.secret) as {
        sub: string;
        type: string;
      };

      if (decoded.type !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Find user
      const user = DEMO_USERS.find((u) => u.id === decoded.sub);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const payload: UserPayload = {
        sub: user.id,
        username: user.username,
        role: user.role,
      };

      // Generate new access token
      const accessToken = jwt.sign(payload, config.secret, {
        expiresIn: config.expiresIn,
      } as jwt.SignOptions);

      // Generate new refresh token
      const refreshPayload = { sub: user.id, type: "refresh" };
      const newRefreshToken = jwt.sign(refreshPayload, config.secret, {
        expiresIn: config.refreshExpiresIn,
      } as jwt.SignOptions);

      logger.info("Token refreshed", { userId: user.id });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        tokenType: "Bearer",
        expiresIn: config.expiresIn,
      };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new UnauthorizedException("Refresh token expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new UnauthorizedException("Invalid refresh token");
      }
      throw error;
    }
  }

  /**
   * Build user profile from Gateway headers
   */
  getUserProfile(userPayload: UserPayload): UserProfileResponse {
    logger.debug("Building user profile", { userId: userPayload.sub });

    return {
      id: userPayload.sub,
      username: userPayload.username,
      role: userPayload.role,
    };
  }

  /**
   * Verify a token and return the payload
   */
  verifyToken(token: string): UserPayload {
    const config = this.getJwtConfig();

    try {
      const decoded = jwt.verify(token, config.secret) as UserPayload;
      return decoded;
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new UnauthorizedException("Token expired");
      }
      throw new UnauthorizedException("Invalid token");
    }
  }
}
