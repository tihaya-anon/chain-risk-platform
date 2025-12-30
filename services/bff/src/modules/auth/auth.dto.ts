import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Username', example: 'admin' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ description: 'Password', example: 'admin123' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  tokenType: string;

  @ApiProperty()
  expiresIn: string;
}

export class UserPayload {
  sub: string;
  username: string;
  role: string;
}

export class UserProfileResponse {
  @ApiProperty({ description: 'User ID', example: '1' })
  id: string;

  @ApiProperty({ description: 'Username', example: 'admin' })
  username: string;

  @ApiProperty({ description: 'User role', example: 'admin', enum: ['admin', 'user'] })
  role: string;
}
