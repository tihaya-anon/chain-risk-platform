import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RiskScoreRequestDto {
  @ApiProperty({
    description: "Ethereum address",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0",
  })
  @IsString()
  address: string;

  @ApiPropertyOptional({ description: "Network", default: "ethereum" })
  @IsString()
  @IsOptional()
  network?: string = "ethereum";

  @ApiPropertyOptional({
    description: "Include detailed risk factors",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeFactors?: boolean = true;
}

export class BatchRiskScoreRequestDto {
  @ApiProperty({ description: "List of addresses", type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  addresses: string[];

  @ApiPropertyOptional({ description: "Network", default: "ethereum" })
  @IsString()
  @IsOptional()
  network?: string = "ethereum";

  @ApiPropertyOptional({
    description: "Include detailed risk factors",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeFactors?: boolean = false;
}

export class RiskFactorResponse {
  @ApiProperty()
  name: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  description: string;

  @ApiProperty()
  triggered: boolean;
}

export class RiskScoreResponse {
  @ApiProperty()
  address: string;

  @ApiProperty()
  network: string;

  @ApiProperty()
  riskScore: number;

  @ApiProperty({ enum: ["low", "medium", "high", "critical"] })
  riskLevel: string;

  @ApiProperty({ type: [RiskFactorResponse] })
  factors: RiskFactorResponse[];

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  evaluatedAt: string;

  @ApiProperty()
  cached: boolean;
}

export class BatchRiskScoreResponse {
  @ApiProperty({ type: [RiskScoreResponse] })
  results: RiskScoreResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  failed: number;
}

export class RiskRule {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  enabled: boolean;
}
