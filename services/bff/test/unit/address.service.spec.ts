import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { AddressService } from "../../src/modules/address/address.service";
import * as fixtures from "../mocks/fixtures";

// Mock config
jest.mock("../../src/config/config", () => ({
  getConfig: () => ({
    services: {
      query: { url: "http://query-service:8080", timeout: 5000 },
      risk: { url: "http://risk-service:8000", timeout: 5000 },
      graph: { url: "http://graph-service:8081", timeout: 5000 },
    },
  }),
}));

describe("AddressService", () => {
  let service: AddressService;
  let mock: MockAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressService],
    }).compile();

    service = module.get<AddressService>(AddressService);

    // Access internal client and mock it
    const client = (service as any).client;
    mock = new MockAdapter(client);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("getAddressInfo", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return address info on success", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply(200, 
        fixtures.mockQueryServiceResponse(
          fixtures.createMockAddress({ address: testAddress }),
        ),
      );

      const result = await service.getAddressInfo(testAddress);

      expect(result.address).toBe(testAddress);
      expect(result.network).toBe("ethereum");
      expect(result.totalTxCount).toBeDefined();
    });

    it("should pass network parameter", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply((config) => {
        expect(config.params.network).toBe("bsc");
        return [200, fixtures.mockQueryServiceResponse(
          fixtures.createMockAddress({ address: testAddress, network: "bsc" }),
        )];
      });

      const result = await service.getAddressInfo(testAddress, "bsc");
      expect(result.network).toBe("bsc");
    });

    it("should throw HttpException on API error", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply(200, 
        fixtures.mockQueryServiceError("Address not found"),
      );

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(HttpException);
    });

    it("should throw NOT_FOUND on 404", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).reply(404, {
        error: { message: "Not found" },
      });

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(new HttpException("Address not found", HttpStatus.NOT_FOUND));
    });

    it("should handle network errors", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}`).networkError();

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(HttpException);
    });
  });

  describe("getAddressTransfers", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return paginated transfers", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}/transfers`).reply(200,
        fixtures.mockQueryServiceResponse(
          fixtures.mockTransferList.items,
          fixtures.mockTransferList.pagination,
        ),
      );

      const result = await service.getAddressTransfers(testAddress, {});

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(150);
    });

    it("should pass query parameters", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}/transfers`).reply((config) => {
        expect(config.params).toEqual({
          network: "ethereum",
          page: 2,
          pageSize: 50,
          transferType: "erc20",
        });
        return [200, fixtures.mockQueryServiceResponse([], { page: 2, pageSize: 50, total: 0, totalPages: 0 })];
      });

      await service.getAddressTransfers(testAddress, {
        network: "ethereum",
        page: 2,
        pageSize: 50,
        transferType: "erc20",
      });
    });
  });

  describe("getAddressStats", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return address statistics", async () => {
      mock.onGet(`/api/v1/addresses/${testAddress}/stats`).reply(200,
        fixtures.mockQueryServiceResponse(fixtures.mockAddressStats),
      );

      const result = await service.getAddressStats(testAddress);

      expect(result.totalValueSent).toBe("1250.5");
      expect(result.totalValueReceived).toBe("1850.75");
    });
  });

  describe("listTransfers", () => {
    it("should return transfer list with filters", async () => {
      mock.onGet("/api/v1/transfers").reply((config) => {
        expect(config.params.fromAddress).toBe("0xabc");
        return [200, fixtures.mockQueryServiceResponse(
          fixtures.mockTransferList.items,
          fixtures.mockTransferList.pagination,
        )];
      });

      const result = await service.listTransfers({ fromAddress: "0xabc" });

      expect(result.items).toBeDefined();
      expect(result.pagination).toBeDefined();
    });
  });
});
