import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEthereumAddress,
} from "class-validator";

// ============== Request DTOs ==============

export class AddressProfileQueryDto {
  @ApiPropertyOptional({ default: "ethereum" })
  @IsOptional()
  @IsString()
  network?: string = "ethereum";
}

export class AddressAnalysisQueryDto {
  @ApiPropertyOptional({ default: "ethereum" })
  @IsOptional()
  @IsString()
  network?: string = "ethereum";

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  neighborDepth?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  neighborLimit?: number = 20;
}

export class ConnectionQueryDto {
  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDepth?: number = 5;

  @ApiPropertyOptional({ default: "ethereum" })
  @IsOptional()
  @IsString()
  network?: string = "ethereum";
}

export class HighRiskNetworkQueryDto {
  @ApiPropertyOptional({ default: 0.7, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.7;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ============== Response DTOs ==============

export class AddressProfileResponse {
  @ApiProperty()
  address: string;

  @ApiProperty()
  network: string;

  @ApiProperty()
  addressInfo: Record<string, any>;

  @ApiProperty()
  riskScore: Record<string, any>;

  @ApiProperty()
  recentTransfers: Record<string, any>;

  @ApiProperty()
  orchestratedAt: number;
}

export class AddressAnalysisResponse {
  @ApiProperty()
  address: string;

  @ApiProperty()
  network: string;

  @ApiProperty()
  basic: {
    addressInfo: Record<string, any>;
    riskScore: Record<string, any>;
  };

  @ApiProperty()
  graph: {
    graphInfo: Record<string, any>;
    neighbors: Record<string, any>;
    tags: string[];
    cluster: Record<string, any>;
  };

  @ApiProperty()
  alerts: Record<string, any>;

  @ApiProperty()
  orchestratedAt: number;
}

export class ConnectionResponse {
  @ApiProperty()
  fromAddress: string;

  @ApiProperty()
  toAddress: string;

  @ApiProperty()
  path: Record<string, any>;

  @ApiProperty()
  fromAddressRisk: Record<string, any>;

  @ApiProperty()
  toAddressRisk: Record<string, any>;

  @ApiProperty()
  orchestratedAt: number;
}

export class HighRiskNetworkResponse {
  @ApiProperty()
  threshold: number;

  @ApiProperty()
  count: number;

  @ApiProperty({ type: [Object] })
  highRiskAddresses: Record<string, any>[];

  @ApiProperty()
  orchestratedAt: number;
}
