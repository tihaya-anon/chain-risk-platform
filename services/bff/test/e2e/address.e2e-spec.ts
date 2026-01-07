import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, CanActivate } from "@nestjs/common";
import * as request from "supertest";
import MockAdapter from "axios-mock-adapter";
import { AddressModule } from "../../src/modules/address/address.module";
import { AddressService } from "../../src/modules/address/address.service";
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

// Mock user headers for testing
const mockUserHeaders = {
  "X-User-Id": "1",
  "X-User-Username": "testuser",
  "X-User-Role": "admin",
};

describe("AddressController (e2e)", () => {
  let app: INestApplication;
  let mock: MockAdapter;
  let addressService: AddressService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AddressModule],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    addressService = moduleFixture.get<AddressService>(AddressService);
    mock = new MockAdapter((addressService as any).client);
  });

  afterAll(async () => {
    mock.restore();
    await app.close();
  });

  beforeEach(() => {
    mock.reset();
  });

  describe("GET /addresses/:address", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return 200 with address info", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply(200,
        fixtures.mockQueryServiceResponse(
          fixtures.createMockAddress({ address: testAddress }),
        ),
      );

      const response = await request(app.getHttpServer())
        .get(`/addresses/${testAddress}`)
        .set(mockUserHeaders)
        .query({ network: "ethereum" })
        .expect(200);

      expect(response.body.address).toBe(testAddress);
      expect(response.body.totalTxCount).toBeDefined();
    });

    it("should return 404 for non-existent address", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply(404, {
        error: { message: "Not found" },
      });

      await request(app.getHttpServer())
        .get(`/addresses/${testAddress}`)
        .set(mockUserHeaders)
        .expect(404);
    });

    it("should use default network when not specified", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply((config) => {
        expect(config.params.network).toBe("ethereum");
        return [200, fixtures.mockQueryServiceResponse(fixtures.mockAddressInfo)];
      });

      await request(app.getHttpServer())
        .get(`/addresses/${testAddress}`)
        .set(mockUserHeaders)
        .expect(200);
    });
  });

  describe("GET /addresses/:address/transfers", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return paginated transfers", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}/transfers`).reply(200,
        fixtures.mockQueryServiceResponse(
          fixtures.mockTransferList.items,
          fixtures.mockTransferList.pagination,
        ),
      );

      const response = await request(app.getHttpServer())
        .get(`/addresses/${testAddress}/transfers`)
        .set(mockUserHeaders)
        .query({ page: 1, pageSize: 20 })
        .expect(200);

      expect(response.body.items).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it("should pass filter parameters", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}/transfers`).reply((config) => {
        expect(config.params.transferType).toBe("erc20");
        expect(config.params.startTime).toBeDefined();
        return [200, fixtures.mockQueryServiceResponse([], { page: 1, pageSize: 20, total: 0, totalPages: 0 })];
      });

      await request(app.getHttpServer())
        .get(`/addresses/${testAddress}/transfers`)
        .set(mockUserHeaders)
        .query({
          transferType: "erc20",
          startTime: "2024-01-01T00:00:00Z",
        })
        .expect(200);
    });
  });

  describe("GET /addresses/:address/stats", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return address statistics", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}/stats`).reply(200,
        fixtures.mockQueryServiceResponse(fixtures.mockAddressStats),
      );

      const response = await request(app.getHttpServer())
        .get(`/addresses/${testAddress}/stats`)
        .set(mockUserHeaders)
        .expect(200);

      expect(response.body.totalValueSent).toBeDefined();
      expect(response.body.avgTxValue).toBeDefined();
    });
  });
});
