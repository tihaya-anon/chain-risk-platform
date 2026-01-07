/**
 * OpenAPI Mock Generator
 *
 * Generates mock data and mock servers from OpenAPI specs.
 * Enables BFF unit testing without starting actual backend services.
 */

import * as fs from "fs";
import * as path from "path";

// OpenAPI 3.x types
interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  $ref?: string;
  enum?: string[];
  required?: string[];
  default?: unknown;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  additionalProperties?: boolean | OpenAPISchema;
}

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
  };
  definitions?: Record<string, OpenAPISchema>; // Swagger 2.0
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  responses: Record<
    string,
    {
      description: string;
      content?: Record<string, { schema: OpenAPISchema }>;
      schema?: OpenAPISchema; // Swagger 2.0
    }
  >;
}

export class OpenAPIMockGenerator {
  private spec: OpenAPISpec;
  private schemas: Record<string, OpenAPISchema>;

  constructor(specPath: string) {
    const content = fs.readFileSync(specPath, "utf-8");
    this.spec = JSON.parse(content);
    // Support both OpenAPI 3.x and Swagger 2.0
    this.schemas = this.spec.components?.schemas || this.spec.definitions || {};
  }

  /**
   * Generate mock data for a schema
   */
  generateMock(schema: OpenAPISchema, depth = 0): unknown {
    if (depth > 10) return null; // Prevent infinite recursion

    // Handle $ref
    if (schema.$ref) {
      const refName = this.extractRefName(schema.$ref);
      const refSchema = this.schemas[refName];
      if (refSchema) {
        return this.generateMock(refSchema, depth + 1);
      }
      return {};
    }

    // Handle allOf
    if (schema.allOf) {
      return schema.allOf.reduce((acc, s) => {
        const result = this.generateMock(s, depth + 1);
        return { ...(acc as object), ...(result as object) };
      }, {});
    }

    // Handle oneOf/anyOf - pick first
    if (schema.oneOf?.length) {
      return this.generateMock(schema.oneOf[0], depth + 1);
    }
    if (schema.anyOf?.length) {
      return this.generateMock(schema.anyOf[0], depth + 1);
    }

    // Use example if provided
    if (schema.example !== undefined) {
      return schema.example;
    }

    // Use default if provided
    if (schema.default !== undefined) {
      return schema.default;
    }

    // Generate by type
    switch (schema.type) {
      case "string":
        return this.generateString(schema);
      case "number":
      case "integer":
        return this.generateNumber(schema);
      case "boolean":
        return true;
      case "array":
        return this.generateArray(schema, depth);
      case "object":
      default:
        return this.generateObject(schema, depth);
    }
  }

  private generateString(schema: OpenAPISchema): string {
    if (schema.enum?.length) {
      return schema.enum[0];
    }

    switch (schema.format) {
      case "date-time":
        return new Date().toISOString();
      case "date":
        return new Date().toISOString().split("T")[0];
      case "email":
        return "test@example.com";
      case "uri":
      case "url":
        return "https://example.com";
      case "uuid":
        return "550e8400-e29b-41d4-a716-446655440000";
      case "double":
      case "float":
        return "0.0";
      default:
        return "mock_string";
    }
  }

  private generateNumber(schema: OpenAPISchema): number {
    const min = schema.minimum ?? 0;
    const max = schema.maximum ?? 100;
    if (schema.type === "integer") {
      return Math.floor((min + max) / 2);
    }
    return (min + max) / 2;
  }

  private generateArray(schema: OpenAPISchema, depth: number): unknown[] {
    if (!schema.items) return [];
    const count = schema.minItems || 1;
    return Array(count)
      .fill(null)
      .map(() => this.generateMock(schema.items!, depth + 1));
  }

  private generateObject(
    schema: OpenAPISchema,
    depth: number,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        result[key] = this.generateMock(propSchema, depth + 1);
      }
    }

    return result;
  }

  private extractRefName(ref: string): string {
    // Handle both #/components/schemas/Name and #/definitions/Name
    const parts = ref.split("/");
    return parts[parts.length - 1];
  }

  /**
   * Generate mock response for an endpoint
   */
  generateResponseMock(
    pathPattern: string,
    method: string,
    statusCode = "200",
  ): unknown {
    const pathKey = Object.keys(this.spec.paths).find((p) =>
      this.matchPath(p, pathPattern),
    );

    if (!pathKey) {
      throw new Error(`Path not found: ${pathPattern}`);
    }

    const operation = this.spec.paths[pathKey][method.toLowerCase()];
    if (!operation) {
      throw new Error(`Method ${method} not found for path ${pathPattern}`);
    }

    const response = operation.responses[statusCode];
    if (!response) {
      throw new Error(`Status ${statusCode} not found for ${method} ${pathPattern}`);
    }

    // OpenAPI 3.x
    if (response.content?.["application/json"]?.schema) {
      return this.generateMock(response.content["application/json"].schema);
    }

    // Swagger 2.0
    if (response.schema) {
      return this.generateMock(response.schema);
    }

    return {};
  }

  /**
   * Get schema by name
   */
  getSchema(name: string): OpenAPISchema | undefined {
    return this.schemas[name];
  }

  /**
   * Generate mock for a named schema
   */
  generateSchemaMock(schemaName: string): unknown {
    const schema = this.schemas[schemaName];
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }
    return this.generateMock(schema);
  }

  private matchPath(pattern: string, actual: string): boolean {
    // Convert OpenAPI path params to regex
    const regex = new RegExp(
      "^" + pattern.replace(/\{[^}]+\}/g, "[^/]+") + "$",
    );
    return regex.test(actual);
  }

  /**
   * List all available endpoints
   */
  listEndpoints(): Array<{ path: string; method: string; operationId?: string }> {
    const endpoints: Array<{ path: string; method: string; operationId?: string }> = [];

    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: (operation as OpenAPIOperation).operationId,
          });
        }
      }
    }

    return endpoints;
  }
}

/**
 * Load all service specs
 */
export function loadServiceSpecs(): Record<string, OpenAPIMockGenerator> {
  const specsDir = path.resolve(__dirname, "../../../../docs/api-specs");

  return {
    query: new OpenAPIMockGenerator(path.join(specsDir, "query-service.openapi.json")),
    risk: new OpenAPIMockGenerator(path.join(specsDir, "risk-ml-service.openapi.json")),
    graph: new OpenAPIMockGenerator(path.join(specsDir, "graph-service.openapi.json")),
  };
}
