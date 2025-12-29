import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponse } from './auth.dto';
import { GatewayAuthGuard } from '../../common/guards';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponse })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(GatewayAuthGuard)
  @ApiHeader({ name: 'X-User-Id', description: 'User ID (provided by Gateway)', required: true })
  @ApiHeader({ name: 'X-User-Username', description: 'Username (provided by Gateway)', required: true })
  @ApiHeader({ name: 'X-User-Role', description: 'User role (provided by Gateway)', required: true })
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async getProfile(@Request() req: any) {
    return req.user;
  }
}
