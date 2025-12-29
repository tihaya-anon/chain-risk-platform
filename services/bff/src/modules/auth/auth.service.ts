import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { LoginDto, UserPayload } from './auth.dto';
import { getLogger } from '../../common/logger';
import { getConfig } from '../../config/config';

const logger = getLogger('AuthService');
const config = getConfig();

// Demo users - in production, use a database
const DEMO_USERS = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'user', password: 'user123', role: 'user' },
];

@Injectable()
export class AuthService {
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

    // Generate JWT token for Gateway
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    logger.info('Login successful', { username: user.username, role: user.role });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.expiresIn,
    };
  }
}
