import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ============== Query DTOs ==============

export class AddressPathParamDto {
  @ApiProperty({ description: "Blockchain address (0x-prefixed)" })
  @IsString()
  address: string;
}

export class GetNeighborsQueryDto {
  @ApiPropertyOptional({ description: "Search depth (1-3)", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  depth?: number = 1;

  @ApiPropertyOptional({
    description: "Maximum number of neighbors to return",
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;
}

export class FindPathQueryDto {
  @ApiPropertyOptional({ description: "Maximum path depth", default: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxDepth?: number = 5;
}

export class SearchByTagQueryDto {
  @ApiPropertyOptional({ description: "Maximum results", default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;
}

export class GetHighRiskQueryDto {
  @ApiPropertyOptional({
    description: "Risk score threshold (0.0 - 1.0)",
    default: 0.6,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  threshold?: number = 0.6;

  @ApiPropertyOptional({ description: "Maximum results", default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;
}

// ============== Request DTOs ==============

export class AddTagRequestDto {
  @ApiProperty({ description: "Tags to add", type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiPropertyOptional({ description: "Source of the tag" })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: "Confidence score (0.0 - 1.0)" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;
}

export class ManualClusterRequestDto {
  @ApiProperty({ description: "List of addresses to cluster", type: [String] })
  @IsArray()
  @IsString({ each: true })
  addresses: string[];
}

// ============== Response DTOs ==============

export class AddressInfoResponse {
  @ApiProperty({ description: "Blockchain address" })
  address: string;

  @ApiPropertyOptional({ description: "First seen timestamp" })
  firstSeen?: string;

  @ApiPropertyOptional({ description: "Last seen timestamp" })
  lastSeen?: string;

  @ApiPropertyOptional({ description: "Transaction count" })
  txCount?: number;

  @ApiPropertyOptional({ description: "Risk score (0.0 - 1.0)" })
  riskScore?: number;

  @ApiPropertyOptional({
    description: "Tags associated with the address",
    type: [String],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Cluster ID if address belongs to a cluster",
  })
  clusterId?: string;

  @ApiPropertyOptional({ description: "Network (e.g., ethereum)" })
  network?: string;

  @ApiPropertyOptional({ description: "Incoming transfer count" })
  incomingCount?: number;

  @ApiPropertyOptional({ description: "Outgoing transfer count" })
  outgoingCount?: number;
}

export class NeighborInfo {
  @ApiProperty({ description: "Neighbor address" })
  address: string;

  @ApiPropertyOptional({
    description: "Direction of transfers (IN, OUT, BOTH)",
  })
  direction?: string;

  @ApiPropertyOptional({ description: "Number of transfers" })
  transferCount?: number;

  @ApiPropertyOptional({ description: "Total value transferred" })
  totalValue?: string;

  @ApiPropertyOptional({ description: "Last transfer timestamp" })
  lastTransfer?: string;

  @ApiPropertyOptional({ description: "Risk score" })
  riskScore?: number;

  @ApiPropertyOptional({ description: "Tags", type: [String] })
  tags?: string[];
}

export class AddressNeighborsResponse {
  @ApiProperty({ description: "Center address" })
  address: string;

  @ApiProperty({ description: "List of neighbors", type: [NeighborInfo] })
  neighbors: NeighborInfo[];

  @ApiPropertyOptional({ description: "Total neighbor count" })
  totalCount?: number;

  @ApiPropertyOptional({ description: "Search depth used" })
  depth?: number;
}

export class PathNode {
  @ApiProperty({ description: "Address in the path" })
  address: string;

  @ApiPropertyOptional({ description: "Transaction hash" })
  txHash?: string;

  @ApiPropertyOptional({ description: "Transfer value" })
  value?: string;

  @ApiPropertyOptional({ description: "Transfer timestamp" })
  timestamp?: string;

  @ApiPropertyOptional({ description: "Risk score" })
  riskScore?: number;

  @ApiPropertyOptional({ description: "Tags", type: [String] })
  tags?: string[];
}

export class PathResponse {
  @ApiProperty({ description: "Whether a path was found" })
  found: boolean;

  @ApiProperty({ description: "Source address" })
  fromAddress: string;

  @ApiProperty({ description: "Target address" })
  toAddress: string;

  @ApiPropertyOptional({ description: "Path length (number of hops)" })
  pathLength?: number;

  @ApiPropertyOptional({ description: "Maximum depth searched" })
  maxDepth?: number;

  @ApiPropertyOptional({ description: "Message (e.g., path not found reason)" })
  message?: string;

  @ApiPropertyOptional({ description: "Path nodes", type: [PathNode] })
  path?: PathNode[];
}

export class ClusterResponse {
  @ApiProperty({ description: "Cluster ID" })
  clusterId: string;

  @ApiPropertyOptional({ description: "Number of addresses in cluster" })
  size?: number;

  @ApiPropertyOptional({ description: "Aggregate risk score" })
  riskScore?: number;

  @ApiPropertyOptional({ description: "Cluster label" })
  label?: string;

  @ApiPropertyOptional({ description: "Cluster category" })
  category?: string;

  @ApiPropertyOptional({ description: "Cluster tags", type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: "Addresses in cluster", type: [String] })
  addresses?: string[];

  @ApiPropertyOptional({ description: "Creation timestamp" })
  createdAt?: string;

  @ApiPropertyOptional({ description: "Last update timestamp" })
  updatedAt?: string;

  @ApiPropertyOptional({ description: "Network" })
  network?: string;
}

export class SyncStatusResponse {
  @ApiProperty({
    description: "Sync status (IDLE, RUNNING, COMPLETED, FAILED)",
  })
  status: string;

  @ApiPropertyOptional({ description: "Last synced block number" })
  lastSyncedBlock?: number;

  @ApiPropertyOptional({ description: "Total addresses in graph" })
  totalAddresses?: number;

  @ApiPropertyOptional({ description: "Total transfers in graph" })
  totalTransfers?: number;

  @ApiPropertyOptional({ description: "Last sync timestamp" })
  lastSyncTime?: string;

  @ApiPropertyOptional({ description: "Next scheduled sync time" })
  nextSyncTime?: string;

  @ApiPropertyOptional({ description: "Network" })
  network?: string;

  @ApiPropertyOptional({ description: "Error message if failed" })
  errorMessage?: string;
}

export class PropagationResultResponse {
  @ApiProperty({ description: "Propagation status" })
  status: string;

  @ApiPropertyOptional({ description: "Number of addresses affected" })
  addressesAffected?: number;

  @ApiPropertyOptional({ description: "Number of tags propagated" })
  tagsPropagated?: number;

  @ApiPropertyOptional({ description: "Maximum hops used" })
  maxHops?: number;

  @ApiPropertyOptional({ description: "Decay factor used" })
  decayFactor?: number;

  @ApiPropertyOptional({ description: "Duration in milliseconds" })
  durationMs?: number;

  @ApiPropertyOptional({ description: "Start timestamp" })
  startedAt?: string;

  @ApiPropertyOptional({ description: "Completion timestamp" })
  completedAt?: string;

  @ApiPropertyOptional({ description: "Error message if failed" })
  errorMessage?: string;
}

export class ClusteringResultResponse {
  @ApiProperty({ description: "Clustering status" })
  status: string;

  @ApiPropertyOptional({ description: "Number of clusters created" })
  clustersCreated?: number;

  @ApiPropertyOptional({ description: "Number of addresses clustered" })
  addressesClustered?: number;

  @ApiPropertyOptional({ description: "Duration in milliseconds" })
  durationMs?: number;

  @ApiPropertyOptional({ description: "Start timestamp" })
  startedAt?: string;

  @ApiPropertyOptional({ description: "Completion timestamp" })
  completedAt?: string;

  @ApiPropertyOptional({ description: "Error message if failed" })
  errorMessage?: string;
}
