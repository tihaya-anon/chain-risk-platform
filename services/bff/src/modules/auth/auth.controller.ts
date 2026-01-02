import { Controller, Post, Body, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto, LoginResponse, UserProfileResponse } from "./auth.dto";
import { GatewayAuthGuard } from "../../common/guards";
import { GatewayUser } from "../../common/decorators/gateway-user.decorator";
import { UserPayload } from "./auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "User login" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: LoginResponse,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Get("profile")
  @UseGuards(GatewayAuthGuard)
  @ApiHeader({
    name: "X-User-Id",
    description: "User ID (provided by Gateway)",
    required: true,
  })
  @ApiHeader({
    name: "X-User-Username",
    description: "Username (provided by Gateway)",
    required: true,
  })
  @ApiHeader({
    name: "X-User-Role",
    description: "User role (provided by Gateway)",
    required: true,
  })
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile",
    type: UserProfileResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  async getProfile(
    @GatewayUser() user: UserPayload,
  ): Promise<UserProfileResponse> {
    // Extract user info from Gateway headers and build profile
    return this.authService.getUserProfile(user);
  }
}
