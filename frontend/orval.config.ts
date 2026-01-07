import { defineConfig } from "orval"

export default defineConfig({
  bff: {
    input: {
      target: "../docs/api-specs/bff.openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated/bff",
      schemas: "./src/api/generated/models",
      client: "react-query",
      httpClient: "axios",
      mock: true,
      override: {
        mutator: {
          path: "./src/api/axios-instance.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  orchestrator: {
    input: {
      target: "../docs/api-specs/orchestrator.openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated/orchestrator",
      schemas: "./src/api/generated/models",
      client: "react-query",
      httpClient: "axios",
      mock: true,
      override: {
        mutator: {
          path: "./src/api/axios-instance.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
})
