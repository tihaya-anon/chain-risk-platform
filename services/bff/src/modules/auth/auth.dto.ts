import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ description: "Username", example: "admin" })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ description: "Password", example: "admin123" })
  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginResponse {
  @ApiProperty({ description: "JWT access token" })
  accessToken: string;

  @ApiProperty({ description: "Refresh token for obtaining new access tokens" })
  refreshToken: string;

  @ApiProperty({ description: "Token type", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "Access token expiration time", example: "1h" })
  expiresIn: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: "Refresh token" })
  @IsString()
  refreshToken: string;
}

export class RefreshTokenResponse {
  @ApiProperty({ description: "New JWT access token" })
  accessToken: string;

  @ApiProperty({ description: "New refresh token" })
  refreshToken: string;

  @ApiProperty({ description: "Token type", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "Access token expiration time", example: "1h" })
  expiresIn: string;
}

export class UserPayload {
  sub: string;
  username: string;
  role: string;
}

export class UserProfileResponse {
  @ApiProperty({ description: "User ID", example: "1" })
  id: string;

  @ApiProperty({ description: "Username", example: "admin" })
  username: string;

  @ApiProperty({
    description: "User role",
    example: "admin",
    enum: ["admin", "user", "analyst"],
  })
  role: string;
}
