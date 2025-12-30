import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { GraphService } from './graph.service';
import {
  GetNeighborsQueryDto,
  FindPathQueryDto,
  SearchByTagQueryDto,
  GetHighRiskQueryDto,
  AddTagRequestDto,
  ManualClusterRequestDto,
  AddressInfoResponse,
  AddressNeighborsResponse,
  PathResponse,
  ClusterResponse,
  SyncStatusResponse,
  PropagationResultResponse,
  ClusteringResultResponse,
} from './graph.dto';
import { GatewayAuthGuard } from '../../common/guards';
import { GatewayUser } from '../../common/decorators/gateway-user.decorator';
import { UserPayload } from '../auth/auth.dto';
import { getLogger } from '../../common/logger';

const logger = getLogger('GraphController');

@ApiTags('graph')
@Controller('graph')
@UseGuards(GatewayAuthGuard)
@ApiHeader({ name: 'X-User-Id', description: 'User ID (provided by Gateway)', required: true })
@ApiHeader({ name: 'X-User-Username', description: 'Username (provided by Gateway)', required: true })
@ApiHeader({ name: 'X-User-Role', description: 'User role (provided by Gateway)', required: true })
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  // ============== Address Endpoints ==============

  @Get('address/:address')
  @ApiOperation({ summary: 'Get address information from graph' })
  @ApiParam({ name: 'address', description: 'Blockchain address (0x-prefixed)' })
  @ApiResponse({ status: 200, description: 'Address information', type: AddressInfoResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async getAddressInfo(
    @Param('address') address: string,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressInfoResponse> {
    logger.debug('Getting address info from graph', { address, userId: user.sub });
    return this.graphService.getAddressInfo(address);
  }

  @Get('address/:address/neighbors')
  @ApiOperation({ summary: 'Get address neighbors' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiResponse({ status: 200, description: 'Address neighbors', type: AddressNeighborsResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAddressNeighbors(
    @Param('address') address: string,
    @Query() query: GetNeighborsQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressNeighborsResponse> {
    logger.debug('Getting address neighbors', { address, ...query, userId: user.sub });
    return this.graphService.getAddressNeighbors(address, query.depth, query.limit);
  }

  @Get('address/:address/tags')
  @ApiOperation({ summary: 'Get address tags' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiResponse({ status: 200, description: 'Address tags', type: [String] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAddressTags(
    @Param('address') address: string,
    @GatewayUser() user: UserPayload,
  ): Promise<string[]> {
    logger.debug('Getting address tags', { address, userId: user.sub });
    return this.graphService.getAddressTags(address);
  }

  @Post('address/:address/tags')
  @ApiOperation({ summary: 'Add tags to address' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiResponse({ status: 200, description: 'Updated address info', type: AddressInfoResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addAddressTags(
    @Param('address') address: string,
    @Body() request: AddTagRequestDto,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressInfoResponse> {
    logger.info('Adding tags to address', { address, tags: request.tags, userId: user.sub });
    return this.graphService.addAddressTags(address, request);
  }

  @Delete('address/:address/tags/:tag')
  @ApiOperation({ summary: 'Remove tag from address' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiParam({ name: 'tag', description: 'Tag to remove' })
  @ApiResponse({ status: 200, description: 'Tag removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeAddressTag(
    @Param('address') address: string,
    @Param('tag') tag: string,
    @GatewayUser() user: UserPayload,
  ): Promise<void> {
    logger.info('Removing tag from address', { address, tag, userId: user.sub });
    return this.graphService.removeAddressTag(address, tag);
  }

  @Get('address/:address/cluster')
  @ApiOperation({ summary: 'Get cluster that address belongs to' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiResponse({ status: 200, description: 'Cluster information', type: ClusterResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not in any cluster' })
  async getAddressCluster(
    @Param('address') address: string,
    @GatewayUser() user: UserPayload,
  ): Promise<ClusterResponse> {
    logger.debug('Getting address cluster', { address, userId: user.sub });
    return this.graphService.getAddressCluster(address);
  }

  // ============== Path Endpoints ==============

  @Get('path/:fromAddress/:toAddress')
  @ApiOperation({ summary: 'Find shortest path between two addresses' })
  @ApiParam({ name: 'fromAddress', description: 'Source address' })
  @ApiParam({ name: 'toAddress', description: 'Target address' })
  @ApiResponse({ status: 200, description: 'Path result', type: PathResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findPath(
    @Param('fromAddress') fromAddress: string,
    @Param('toAddress') toAddress: string,
    @Query() query: FindPathQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<PathResponse> {
    logger.debug('Finding path', { fromAddress, toAddress, ...query, userId: user.sub });
    return this.graphService.findPath(fromAddress, toAddress, query.maxDepth);
  }

  // ============== Cluster Endpoints ==============

  @Get('cluster/:clusterId')
  @ApiOperation({ summary: 'Get cluster by ID' })
  @ApiParam({ name: 'clusterId', description: 'Cluster ID' })
  @ApiResponse({ status: 200, description: 'Cluster information', type: ClusterResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cluster not found' })
  async getCluster(
    @Param('clusterId') clusterId: string,
    @GatewayUser() user: UserPayload,
  ): Promise<ClusterResponse> {
    logger.debug('Getting cluster', { clusterId, userId: user.sub });
    return this.graphService.getCluster(clusterId);
  }

  @Post('cluster/run')
  @ApiOperation({ summary: 'Run clustering algorithm' })
  @ApiResponse({ status: 200, description: 'Clustering result', type: ClusteringResultResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async runClustering(
    @GatewayUser() user: UserPayload,
  ): Promise<ClusteringResultResponse> {
    logger.info('Running clustering algorithm', { userId: user.sub });
    return this.graphService.runClustering();
  }

  @Post('cluster/manual')
  @ApiOperation({ summary: 'Manually cluster addresses' })
  @ApiResponse({ status: 200, description: 'Clustering result', type: ClusteringResultResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async manualCluster(
    @Body() request: ManualClusterRequestDto,
    @GatewayUser() user: UserPayload,
  ): Promise<ClusteringResultResponse> {
    logger.info('Creating manual cluster', { addressCount: request.addresses.length, userId: user.sub });
    return this.graphService.manualCluster(request.addresses);
  }

  // ============== Search Endpoints ==============

  @Get('search/tag/:tag')
  @ApiOperation({ summary: 'Search addresses by tag' })
  @ApiParam({ name: 'tag', description: 'Tag to search for' })
  @ApiResponse({ status: 200, description: 'Matching addresses', type: [AddressInfoResponse] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchByTag(
    @Param('tag') tag: string,
    @Query() query: SearchByTagQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressInfoResponse[]> {
    logger.debug('Searching by tag', { tag, ...query, userId: user.sub });
    return this.graphService.searchByTag(tag, query.limit);
  }

  @Get('search/high-risk')
  @ApiOperation({ summary: 'Get high-risk addresses' })
  @ApiResponse({ status: 200, description: 'High-risk addresses', type: [AddressInfoResponse] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHighRiskAddresses(
    @Query() query: GetHighRiskQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressInfoResponse[]> {
    logger.debug('Getting high-risk addresses', { ...query, userId: user.sub });
    return this.graphService.getHighRiskAddresses(query.threshold, query.limit);
  }

  // ============== Sync Endpoints ==============

  @Get('sync/status')
  @ApiOperation({ summary: 'Get sync status' })
  @ApiResponse({ status: 200, description: 'Sync status', type: SyncStatusResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSyncStatus(
    @GatewayUser() user: UserPayload,
  ): Promise<SyncStatusResponse> {
    logger.debug('Getting sync status', { userId: user.sub });
    return this.graphService.getSyncStatus();
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger data sync' })
  @ApiResponse({ status: 200, description: 'Sync triggered', type: SyncStatusResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async triggerSync(
    @GatewayUser() user: UserPayload,
  ): Promise<SyncStatusResponse> {
    logger.info('Triggering sync', { userId: user.sub });
    return this.graphService.triggerSync();
  }

  // ============== Propagation Endpoints ==============

  @Post('propagate')
  @ApiOperation({ summary: 'Propagate risk tags to neighbors' })
  @ApiResponse({ status: 200, description: 'Propagation result', type: PropagationResultResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async propagateTags(
    @GatewayUser() user: UserPayload,
  ): Promise<PropagationResultResponse> {
    logger.info('Propagating tags', { userId: user.sub });
    return this.graphService.propagateTags();
  }

  @Post('propagate/:address')
  @ApiOperation({ summary: 'Propagate risk from specific address' })
  @ApiParam({ name: 'address', description: 'Source address' })
  @ApiResponse({ status: 200, description: 'Propagation result', type: PropagationResultResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async propagateFromAddress(
    @Param('address') address: string,
    @GatewayUser() user: UserPayload,
  ): Promise<PropagationResultResponse> {
    logger.info('Propagating from address', { address, userId: user.sub });
    return this.graphService.propagateFromAddress(address);
  }
}
