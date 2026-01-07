/**
 * E2E Test Setup
 */

// Increase timeout for e2e tests
jest.setTimeout(30000);

// Mock logger to reduce noise
jest.mock("../src/common/logger", () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock Nacos
jest.mock("../src/common/nacos.service", () => ({
  NacosService: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    shutdown: jest.fn(),
  })),
}));
