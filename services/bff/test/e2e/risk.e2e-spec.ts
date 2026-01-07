import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, CanActivate } from "@nestjs/common";
import * as request from "supertest";
import MockAdapter from "axios-mock-adapter";
import { RiskModule } from "../../src/modules/risk/risk.module";
import { RiskService } from "../../src/modules/risk/risk.service";
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

describe("RiskController (e2e)", () => {
  let app: INestApplication;
  let mock: MockAdapter;
  let riskService: RiskService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RiskModule],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    riskService = moduleFixture.get<RiskService>(RiskService);
    mock = new MockAdapter((riskService as any).client);
  });

  afterAll(async () => {
    mock.restore();
    await app.close();
  });

  beforeEach(() => {
    mock.reset();
  });

  describe("POST /risk/score", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return risk score for address", async () => {
      mock.onPost("/api/v1/risk/score").reply(200, fixtures.mockRiskScore);

      const response = await request(app.getHttpServer())
        .post("/risk/score")
        .set(mockUserHeaders)
        .send({ address: testAddress })
        .expect(201);

      expect(response.body.address).toBe(testAddress);
      expect(response.body.riskScore).toBeDefined();
      expect(response.body.riskLevel).toBeDefined();
    });

    it("should include factors when requested", async () => {
      mock.onPost("/api/v1/risk/score").reply(200, fixtures.mockRiskScore);

      const response = await request(app.getHttpServer())
        .post("/risk/score")
        .set(mockUserHeaders)
        .send({ address: testAddress, includeFactors: true })
        .expect(201);

      expect(response.body.factors).toBeDefined();
      expect(response.body.factors.length).toBeGreaterThan(0);
    });
  });

  describe("POST /risk/score/batch", () => {
    const addresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
      "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    ];

    it("should return batch risk scores", async () => {
      mock.onPost("/api/v1/risk/batch").reply((config) => {
        const body = JSON.parse(config.data);
        return [200, {
          results: body.addresses.map((addr: string) => ({
            ...fixtures.mockRiskScore,
            address: addr,
          })),
          total: body.addresses.length,
          failed: 0,
        }];
      });

      const response = await request(app.getHttpServer())
        .post("/risk/score/batch")
        .set(mockUserHeaders)
        .send({ addresses })
        .expect(201);

      expect(response.body.results).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });
  });

  describe("GET /risk/rules", () => {
    it("should return list of risk rules", async () => {
      mock.onGet("/api/v1/risk/rules").reply(200, fixtures.mockRiskRules);

      const response = await request(app.getHttpServer())
        .get("/risk/rules")
        .set(mockUserHeaders)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBeDefined();
    });
  });
});
