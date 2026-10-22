import { serializeFilters } from './filters';
import type { CriarProduto, ErrorEnvelope, ProductFilters, ProductPage, Produto } from './types';

export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1'
).replace(/\/$/, '');
export const apiMode = process.env.NEXT_PUBLIC_API_MODE === 'real' ? 'real' : 'mock';

export class ApiError extends Error {
  constructor(
    public status: number,
    public response: ErrorEnvelope,
  ) {
    super(response.error.message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body: ErrorEnvelope = await response.json().catch(() => ({
      error: {
        code: 'HTTP_ERROR',
        message: 'Não foi possível concluir a solicitação.',
        details: [],
        request_id: '',
      },
    }));
    throw new ApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

export function listProducts(filters: ProductFilters, signal?: AbortSignal): Promise<ProductPage> {
  return request(`/produtos?${serializeFilters(filters, true)}`, { method: 'GET', signal });
}

export function createProduct(product: CriarProduto): Promise<Produto> {
  return request('/produtos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
}

export function retryTransient(failureCount: number, error: Error): boolean {
  return (
    failureCount < 1 &&
    (!(error instanceof ApiError) ||
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500)
  );
}
