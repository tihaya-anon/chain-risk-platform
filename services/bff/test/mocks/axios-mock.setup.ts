/**
 * Axios Mock Adapter Setup
 *
 * Provides mock HTTP responses based on OpenAPI fixtures.
 */

import axios, { AxiosInstance } from "axios";
import MockAdapter from "axios-mock-adapter";
import * as fixtures from "./fixtures";

export interface MockConfig {
  queryServiceUrl?: string;
  riskServiceUrl?: string;
  graphServiceUrl?: string;
}

const DEFAULT_CONFIG: MockConfig = {
  queryServiceUrl: "http://query-service:8080",
  riskServiceUrl: "http://risk-ml-service:8000",
  graphServiceUrl: "http://graph-service:8081",
};

/**
 * Creates mock adapters for all backend service clients
 */
export function createServiceMocks(
  clients: {
    query?: AxiosInstance;
    risk?: AxiosInstance;
    graph?: AxiosInstance;
  },
  config: MockConfig = DEFAULT_CONFIG,
) {
  const mocks: Record<string, MockAdapter> = {};

  if (clients.query) {
    mocks.query = setupQueryServiceMock(clients.query);
  }
  if (clients.risk) {
    mocks.risk = setupRiskServiceMock(clients.risk);
  }
  if (clients.graph) {
    mocks.graph = setupGraphServiceMock(clients.graph);
  }

  return {
    mocks,
    resetAll: () => Object.values(mocks).forEach((m) => m.reset()),
    restoreAll: () => Object.values(mocks).forEach((m) => m.restore()),
  };
}

/**
 * Query Service Mock
 */
export function setupQueryServiceMock(client: AxiosInstance): MockAdapter {
  const mock = new MockAdapter(client);

  // GET /api/v1/addresses/:address
  mock.onGet(/\/api\/v1\/addresses\/0x[a-fA-F0-9]{40}$/).reply((config) => {
    const address = config.url!.split("/").pop();
    return [
      200,
      fixtures.mockQueryServiceResponse(
        fixtures.createMockAddress({ address }),
      ),
    ];
  });

  // GET /api/v1/addresses/:address/stats
  mock.onGet(/\/api\/v1\/addresses\/0x[a-fA-F0-9]{40}\/stats$/).reply(200, 
    fixtures.mockQueryServiceResponse(fixtures.mockAddressStats),
  );

  // GET /api/v1/addresses/:address/transfers
  mock.onGet(/\/api\/v1\/addresses\/0x[a-fA-F0-9]{40}\/transfers$/).reply(200,
    fixtures.mockQueryServiceResponse(
      fixtures.mockTransferList.items,
      fixtures.mockTransferList.pagination,
    ),
  );

  // GET /api/v1/transfers
  mock.onGet("/api/v1/transfers").reply(200,
    fixtures.mockQueryServiceResponse(
      fixtures.mockTransferList.items,
      fixtures.mockTransferList.pagination,
    ),
  );

  // GET /api/v1/transfers/:id
  mock.onGet(/\/api\/v1\/transfers\/\d+$/).reply(200,
    fixtures.mockQueryServiceResponse(fixtures.mockTransfer),
  );

  // GET /api/v1/transfers/tx/:txHash
  mock.onGet(/\/api\/v1\/transfers\/tx\/0x[a-fA-F0-9]{64}$/).reply(200,
    fixtures.mockQueryServiceResponse([fixtures.mockTransfer]),
  );

  return mock;
}

/**
 * Risk Service Mock
 */
export function setupRiskServiceMock(client: AxiosInstance): MockAdapter {
  const mock = new MockAdapter(client);

  // POST /api/v1/risk/score
  mock.onPost("/api/v1/risk/score").reply((config) => {
    const data = JSON.parse(config.data);
    return [
      200,
      fixtures.createMockRiskScore({
        address: data.address,
        network: data.network || "ethereum",
      }),
    ];
  });

  // POST /api/v1/risk/batch
  mock.onPost("/api/v1/risk/batch").reply((config) => {
    const data = JSON.parse(config.data);
    const results = data.addresses.map((address: string) =>
      fixtures.createMockRiskScore({
        address,
        network: data.network || "ethereum",
      }),
    );
    return [
      200,
      {
        results,
        total: results.length,
        failed: 0,
      },
    ];
  });

  // GET /api/v1/risk/rules
  mock.onGet("/api/v1/risk/rules").reply(200, fixtures.mockRiskRules);

  return mock;
}

/**
 * Graph Service Mock
 */
export function setupGraphServiceMock(client: AxiosInstance): MockAdapter {
  const mock = new MockAdapter(client);

  // GET /api/v1/graph/address/:address
  mock.onGet(/\/api\/v1\/graph\/address\/0x[a-fA-F0-9]{40}$/).reply((config) => {
    const address = config.url!.split("/").pop();
    return [
      200,
      { ...fixtures.mockGraphAddressInfo, address },
    ];
  });

  // GET /api/v1/graph/address/:address/neighbors
  mock.onGet(/\/api\/v1\/graph\/address\/0x[a-fA-F0-9]{40}\/neighbors$/).reply((config) => {
    const parts = config.url!.split("/");
    const address = parts[parts.length - 2];
    return [
      200,
      { ...fixtures.mockAddressNeighbors, address },
    ];
  });

  // GET /api/v1/graph/address/:address/tags
  mock.onGet(/\/api\/v1\/graph\/address\/0x[a-fA-F0-9]{40}\/tags$/).reply(200,
    fixtures.mockGraphAddressInfo.tags,
  );

  // POST /api/v1/graph/address/:address/tags
  mock.onPost(/\/api\/v1\/graph\/address\/0x[a-fA-F0-9]{40}\/tags$/).reply((config) => {
    const parts = config.url!.split("/");
    const address = parts[parts.length - 2];
    const data = JSON.parse(config.data);
    return [
      200,
      {
        ...fixtures.mockGraphAddressInfo,
        address,
        tags: [...fixtures.mockGraphAddressInfo.tags, ...data.tags],
      },
    ];
  });

  // DELETE /api/v1/graph/address/:address/tags/:tag
  mock.onDelete(/\/api\/v1\/graph\/address\/0x[a-fA-F0-9]{40}\/tags\/\w+$/).reply(200);

  // GET /api/v1/graph/address/:address/cluster
  mock.onGet(/\/api\/v1\/graph\/address\/0x[a-fA-F0-9]{40}\/cluster$/).reply(200,
    fixtures.mockCluster,
  );

  // GET /api/v1/graph/path/:from/:to
  mock.onGet(/\/api\/v1\/graph\/path\/0x[a-fA-F0-9]{40}\/0x[a-fA-F0-9]{40}$/).reply((config) => {
    const parts = config.url!.split("/");
    const toAddress = parts.pop();
    const fromAddress = parts.pop();
    return [
      200,
      { ...fixtures.mockPathResponse, fromAddress, toAddress },
    ];
  });

  // GET /api/v1/graph/cluster/:clusterId
  mock.onGet(/\/api\/v1\/graph\/cluster\/cluster_\w+$/).reply((config) => {
    const clusterId = config.url!.split("/").pop();
    return [200, { ...fixtures.mockCluster, clusterId }];
  });

  // POST /api/v1/graph/cluster/run
  mock.onPost("/api/v1/graph/cluster/run").reply(200, fixtures.mockClusteringResult);

  // POST /api/v1/graph/cluster/manual
  mock.onPost("/api/v1/graph/cluster/manual").reply(200, fixtures.mockClusteringResult);

  // GET /api/v1/graph/search/tag/:tag
  mock.onGet(/\/api\/v1\/graph\/search\/tag\/\w+$/).reply(200, [fixtures.mockGraphAddressInfo]);

  // GET /api/v1/graph/search/high-risk
  mock.onGet("/api/v1/graph/search/high-risk").reply(200, [fixtures.mockGraphAddressInfo]);

  // POST /api/v1/graph/propagate
  mock.onPost("/api/v1/graph/propagate").reply(200, fixtures.mockPropagationResult);

  // POST /api/v1/graph/propagate/:address
  mock.onPost(/\/api\/v1\/graph\/propagate\/0x[a-fA-F0-9]{40}$/).reply(200, 
    fixtures.mockPropagationResult,
  );

  return mock;
}

/**
 * Create a standalone mock client for testing
 */
export function createMockClient(baseURL: string): {
  client: AxiosInstance;
  mock: MockAdapter;
} {
  const client = axios.create({ baseURL, timeout: 5000 });
  const mock = new MockAdapter(client);
  return { client, mock };
}
