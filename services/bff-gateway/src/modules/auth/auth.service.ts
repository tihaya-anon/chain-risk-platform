import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, UserPayload } from './auth.dto';
import { getLogger } from '../../common/logger';

const logger = getLogger('AuthService');

// Demo users - in production, use a database
const DEMO_USERS = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'user', password: 'user123', role: 'user' },
];

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; tokenType: string; expiresIn: string }> {
    const user = DEMO_USERS.find(
      (u) => u.username === dto.username && u.password === dto.password,
    );

    if (!user) {
      logger.warn('Login failed', { username: dto.username });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: UserPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    logger.info('Login successful', { username: user.username, role: user.role });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '1d',
    };
  }

  async validateUser(payload: UserPayload): Promise<UserPayload | null> {
    const user = DEMO_USERS.find((u) => u.id === payload.sub);
    if (!user) {
      return null;
    }
    return payload;
  }
}
