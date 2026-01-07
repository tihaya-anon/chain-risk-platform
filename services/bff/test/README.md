# BFF Testing Guide

## Overview

BFF testing uses **OpenAPI-based mocking** to test service aggregation without starting backend services.

## Test Structure

```
test/
├── mocks/
│   ├── fixtures.ts           # Pre-generated mock data
│   ├── axios-mock.setup.ts   # Axios mock adapter setup
│   ├── openapi-mock.generator.ts  # Dynamic mock from OpenAPI
│   └── index.ts
├── unit/
│   ├── address.service.spec.ts
│   ├── risk.service.spec.ts
│   └── graph.service.spec.ts
├── e2e/
│   ├── address.e2e-spec.ts
│   ├── risk.e2e-spec.ts
│   └── graph.e2e-spec.ts
├── jest-e2e.json
└── setup.ts
```

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run e2e tests only
npm run test:e2e

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Mock Architecture

### 1. Fixtures (`test/mocks/fixtures.ts`)

Static mock data derived from OpenAPI schemas:

```typescript
import { mockAddressInfo, createMockRiskScore } from '../mocks/fixtures';

// Use pre-defined fixtures
const address = mockAddressInfo;

// Create customized fixtures
const riskScore = createMockRiskScore({ riskLevel: 'high' });
```

### 2. Axios Mock Adapter (`test/mocks/axios-mock.setup.ts`)

Mock HTTP responses for service clients:

```typescript
import MockAdapter from 'axios-mock-adapter';
import { setupQueryServiceMock } from '../mocks/axios-mock.setup';

const mock = new MockAdapter(client);
setupQueryServiceMock(mock);
```

### 3. OpenAPI Mock Generator (`test/mocks/openapi-mock.generator.ts`)

Generate mock data dynamically from OpenAPI specs:

```typescript
import { OpenAPIMockGenerator } from '../mocks/openapi-mock.generator';

const generator = new OpenAPIMockGenerator('path/to/openapi.json');
const mockData = generator.generateSchemaMock('AddressInfo');
```

## Test Patterns

### Unit Test Pattern

```typescript
describe('AddressService', () => {
  let service: AddressService;
  let mock: MockAdapter;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AddressService],
    }).compile();

    service = module.get<AddressService>(AddressService);
    mock = new MockAdapter((service as any).client);
  });

  afterEach(() => mock.restore());

  it('should return address info', async () => {
    mock.onGet('/api/v1/addresses/0x123').reply(200, mockResponse);
    const result = await service.getAddressInfo('0x123');
    expect(result.address).toBe('0x123');
  });
});
```

### E2E Test Pattern

```typescript
describe('AddressController (e2e)', () => {
  let app: INestApplication;
  let mock: MockAdapter;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AddressModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    const service = module.get<AddressService>(AddressService);
    mock = new MockAdapter((service as any).client);
  });

  it('GET /addresses/:address', async () => {
    mock.onGet('/api/v1/addresses/0x123').reply(200, mockResponse);

    await request(app.getHttpServer())
      .get('/addresses/0x123')
      .expect(200)
      .expect(res => {
        expect(res.body.address).toBe('0x123');
      });
  });
});
```

## Adding New Tests

### 1. Add Fixtures

Update `test/mocks/fixtures.ts` with new mock data based on OpenAPI schema.

### 2. Add Mock Routes

Update `test/mocks/axios-mock.setup.ts` with new endpoint mocks.

### 3. Write Tests

Create test files following the patterns above.

## CI Integration

```yaml
# .github/workflows/test.yml
- name: Test BFF
  working-directory: services/bff
  run: |
    npm ci
    npm run test:cov
```
