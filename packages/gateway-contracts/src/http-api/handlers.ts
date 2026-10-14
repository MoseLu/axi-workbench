import { apiContractVersion } from "./types";
import {
  httpEndpointRegistrySchema,
  type HttpEndpointDescriptor,
  type HttpEndpointRegistry,
  type HttpMethod,
} from "./schemas";
import { httpEndpoints } from "./routes";

export const buildHttpEndpointRegistry = (
  endpoints: ReadonlyArray<HttpEndpointDescriptor> = httpEndpoints,
): HttpEndpointRegistry => httpEndpointRegistrySchema.parse({
  contractVersion: apiContractVersion,
  endpoints,
});

export const findHttpEndpoint = (
  id: HttpEndpointDescriptor["id"],
): HttpEndpointDescriptor | null => httpEndpoints.find((endpoint) => endpoint.id === id) ?? null;

export const findHttpEndpointByRoute = (
  method: HttpMethod,
  path: string,
): HttpEndpointDescriptor | null => httpEndpoints.find(
  (endpoint) => endpoint.method === method && endpoint.path === path,
) ?? null;

export const listHttpEndpointErrorStatuses = (): ReadonlyArray<{
  endpointId: HttpEndpointDescriptor["id"];
  status: number;
  errorCodes: ReadonlyArray<string>;
  description: string;
}> => {
  const rows: Array<{
    endpointId: HttpEndpointDescriptor["id"];
    status: number;
    errorCodes: ReadonlyArray<string>;
    description: string;
  }> = [];
  for (const endpoint of httpEndpoints) {
    for (const entry of endpoint.errorStatusCodes) {
      rows.push({
        endpointId: endpoint.id,
        status: entry.status,
        errorCodes: entry.errorCodes,
        description: entry.description,
      });
    }
  }
  return rows;
};

export const listHttpEndpointErrorCodes = (): ReadonlyArray<string> => {
  const codes = new Set<string>();
  for (const endpoint of httpEndpoints) {
    for (const entry of endpoint.errorStatusCodes) {
      for (const code of entry.errorCodes) {
        codes.add(code);
      }
    }
  }
  return [...codes].sort();
};
