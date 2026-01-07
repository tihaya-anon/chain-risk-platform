import { IsString, IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ListTransfersQueryDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Page size", default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "Filter by address (from or to)" })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: "Filter by from address" })
  @IsString()
  @IsOptional()
  fromAddress?: string;

  @ApiPropertyOptional({ description: "Filter by to address" })
  @IsString()
  @IsOptional()
  toAddress?: string;

  @ApiPropertyOptional({ description: "Network", default: "ethereum" })
  @IsString()
  @IsOptional()
  network?: string = "ethereum";
}

export class TransferResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  txHash: string;

  @ApiProperty()
  blockNumber: number;

  @ApiProperty()
  logIndex: number;

  @ApiProperty()
  fromAddress: string;

  @ApiProperty()
  toAddress: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  transferType: string;

  @ApiProperty()
  network: string;

  @ApiPropertyOptional({
    description: "Token contract address (for ERC20 transfers)",
  })
  tokenAddress?: string;

  @ApiPropertyOptional({ description: "Token symbol (for ERC20 transfers)" })
  tokenSymbol?: string;

  @ApiPropertyOptional({
    description: "Token decimal places (for ERC20 transfers)",
  })
  tokenDecimal?: number;
}

export class PaginationMetadata {
  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedTransfersResponse {
  @ApiProperty({ type: [TransferResponse] })
  items: TransferResponse[];

  @ApiProperty({ type: PaginationMetadata })
  pagination: PaginationMetadata;
}
