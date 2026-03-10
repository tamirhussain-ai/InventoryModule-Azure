const FALLBACK_LOCAL_API_URL = 'http://localhost:7071/api';

export const API_BASE_URL =
  import.meta.env.VITE_AZURE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  FALLBACK_LOCAL_API_URL;

export const API_GATEWAY_KEY =
  import.meta.env.VITE_AZURE_FUNCTIONS_API_KEY ||
  import.meta.env.VITE_API_GATEWAY_KEY ||
  '';

export function createGatewayHeaders() {
  return API_GATEWAY_KEY ? { Authorization: `Bearer ${API_GATEWAY_KEY}` } : {};
}

