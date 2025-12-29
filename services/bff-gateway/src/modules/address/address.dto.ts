import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressQueryDto {
  @ApiProperty({ description: 'Ethereum address', example: '0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ description: 'Network', default: 'ethereum' })
  @IsString()
  @IsOptional()
  network?: string = 'ethereum';
}

export class PaginationDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

export class TransferQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Network', default: 'ethereum' })
  @IsString()
  @IsOptional()
  network?: string = 'ethereum';

  @ApiPropertyOptional({ description: 'Transfer type filter' })
  @IsString()
  @IsOptional()
  transferType?: string;

  @ApiPropertyOptional({ description: 'Start time (RFC3339)' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time (RFC3339)' })
  @IsString()
  @IsOptional()
  endTime?: string;
}

export class AddressInfoResponse {
  @ApiProperty()
  address: string;

  @ApiProperty()
  network: string;

  @ApiProperty()
  firstSeen: string;

  @ApiProperty()
  lastSeen: string;

  @ApiProperty()
  totalTxCount: number;

  @ApiProperty()
  sentTxCount: number;

  @ApiProperty()
  receivedTxCount: number;

  @ApiProperty()
  uniqueInteracted: number;
}

export class TransferResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  txHash: string;

  @ApiProperty()
  blockNumber: number;

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
}

export class AddressStatsResponse {
  @ApiProperty()
  totalValueSent: string;

  @ApiProperty()
  totalValueReceived: string;

  @ApiProperty()
  avgTxValue: string;

  @ApiProperty()
  maxTxValue: string;

  @ApiProperty()
  minTxValue: string;
}
