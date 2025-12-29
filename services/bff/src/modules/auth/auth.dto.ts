import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Username', example: 'admin' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ description: 'Password', example: 'password123' })
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
