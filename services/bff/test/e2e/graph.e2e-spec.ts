import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, CanActivate } from "@nestjs/common";
import * as request from "supertest";
import MockAdapter from "axios-mock-adapter";
import { GraphModule } from "../../src/modules/graph/graph.module";
import { GraphService } from "../../src/modules/graph/graph.service";
import { GatewayAuthGuard } from "../../src/common/guards";
import * as fixtures from "../mocks/fixtures";

jest.mock("../../src/config/config", () => ({
  getConfig: () => ({
    server: { port: 3001 },
    services: {
      query: { url: "http://query-service:8080", timeout: 5000 },
      risk: { url: "http://risk-service:8000", timeout: 5000 },
      graph: { url: "http://graph-service:8081", timeout: 5000 },
    },
  }),
}));

const mockGuard: CanActivate = { canActivate: () => true };

const mockUserHeaders = {
  "X-User-Id": "1",
  "X-User-Username": "testuser",
  "X-User-Role": "admin",
};

describe("GraphController (e2e)", () => {
  let app: INestApplication;
  let mock: MockAdapter;
  let graphService: GraphService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GraphModule],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    graphService = moduleFixture.get<GraphService>(GraphService);
    mock = new MockAdapter((graphService as any).client);
  });

  afterAll(async () => {
    mock.restore();
    await app.close();
  });

  beforeEach(() => {
    mock.reset();
  });

  describe("Address Endpoints", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    describe("GET /graph/address/:address", () => {
      it("should return address info from graph", async () => {
        mock.onGet(`/api/v1/graph/address/${testAddress}`).reply(200,
          fixtures.mockGraphAddressInfo,
        );

        const response = await request(app.getHttpServer())
          .get(`/graph/address/${testAddress}`)
          .set(mockUserHeaders)
          .expect(200);

        expect(response.body.address).toBe(testAddress);
        expect(response.body.riskScore).toBeDefined();
      });
    });

    describe("GET /graph/address/:address/neighbors", () => {
      it("should return neighbors", async () => {
        mock.onGet(`/api/v1/graph/address/${testAddress}/neighbors`).reply(200,
          fixtures.mockAddressNeighbors,
        );

        const response = await request(app.getHttpServer())
          .get(`/graph/address/${testAddress}/neighbors`)
          .set(mockUserHeaders)
          .query({ depth: 1, limit: 50 })
          .expect(200);

        expect(response.body.neighbors).toBeDefined();
        expect(response.body.totalCount).toBeDefined();
      });
    });

    describe("GET /graph/address/:address/tags", () => {
      it("should return tags", async () => {
        mock.onGet(`/api/v1/graph/address/${testAddress}/tags`).reply(200,
          ["exchange", "high_volume"],
        );

        const response = await request(app.getHttpServer())
          .get(`/graph/address/${testAddress}/tags`)
          .set(mockUserHeaders)
          .expect(200);

        expect(response.body).toContain("exchange");
      });
    });

    describe("POST /graph/address/:address/tags", () => {
      it("should add tags", async () => {
        mock.onPost(`/api/v1/graph/address/${testAddress}/tags`).reply(200, {
          ...fixtures.mockGraphAddressInfo,
          tags: [...fixtures.mockGraphAddressInfo.tags, "new_tag"],
        });

        const response = await request(app.getHttpServer())
          .post(`/graph/address/${testAddress}/tags`)
          .set(mockUserHeaders)
          .send({ tags: ["new_tag"] })
          .expect(201);

        expect(response.body.tags).toContain("new_tag");
      });
    });

    describe("DELETE /graph/address/:address/tags/:tag", () => {
      it("should remove tag", async () => {
        mock.onDelete(`/api/v1/graph/address/${testAddress}/tags/old_tag`).reply(200);

        await request(app.getHttpServer())
          .delete(`/graph/address/${testAddress}/tags/old_tag`)
          .set(mockUserHeaders)
          .expect(200);
      });
    });
  });

  describe("Path Endpoints", () => {
    const fromAddr = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
    const toAddr = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

    describe("GET /graph/path/:from/:to", () => {
      it("should find path between addresses", async () => {
        mock.onGet(`/api/v1/graph/path/${fromAddr}/${toAddr}`).reply(200,
          fixtures.mockPathResponse,
        );

        const response = await request(app.getHttpServer())
          .get(`/graph/path/${fromAddr}/${toAddr}`)
          .set(mockUserHeaders)
          .expect(200);

        expect(response.body.found).toBe(true);
        expect(response.body.path).toBeDefined();
      });
    });
  });

  describe("Cluster Endpoints", () => {
    describe("GET /graph/cluster/:id", () => {
      it("should return cluster info", async () => {
        mock.onGet("/api/v1/graph/cluster/cluster_001").reply(200,
          fixtures.mockCluster,
        );

        const response = await request(app.getHttpServer())
          .get("/graph/cluster/cluster_001")
          .set(mockUserHeaders)
          .expect(200);

        expect(response.body.clusterId).toBe("cluster_001");
      });
    });

    describe("POST /graph/cluster/run", () => {
      it("should trigger clustering", async () => {
        mock.onPost("/api/v1/graph/cluster/run").reply(200,
          fixtures.mockClusteringResult,
        );

        const response = await request(app.getHttpServer())
          .post("/graph/cluster/run")
          .set(mockUserHeaders)
          .expect(201);

        expect(response.body.status).toBe("completed");
      });
    });
  });

  describe("Search Endpoints", () => {
    describe("GET /graph/search/tag/:tag", () => {
      it("should search by tag", async () => {
        mock.onGet("/api/v1/graph/search/tag/exchange").reply(200,
          [fixtures.mockGraphAddressInfo],
        );

        const response = await request(app.getHttpServer())
          .get("/graph/search/tag/exchange")
          .set(mockUserHeaders)
          .expect(200);

        expect(response.body).toHaveLength(1);
      });
    });

    describe("GET /graph/search/high-risk", () => {
      it("should return high risk addresses", async () => {
        mock.onGet("/api/v1/graph/search/high-risk").reply(200,
          [fixtures.mockGraphAddressInfo],
        );

        const response = await request(app.getHttpServer())
          .get("/graph/search/high-risk")
          .set(mockUserHeaders)
          .query({ threshold: 0.6 })
          .expect(200);

        expect(response.body).toHaveLength(1);
      });
    });
  });
});
