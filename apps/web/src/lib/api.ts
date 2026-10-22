import { serializeFilters } from './filters';
import type { CriarProduto, ErrorEnvelope, ProductFilters, ProductPage, Produto } from './types';
import { clearAdminSession, getAdminAccessToken } from './admin-session';

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

export async function request<T>(path: string, init: RequestInit, admin = false): Promise<T> {
  const token = admin ? getAdminAccessToken() : null;
  if (admin && !token) {
    clearAdminSession('unauthorized');
    throw new ApiError(401, {
      error: {
        code: 'NAO_AUTORIZADO',
        message: 'Entre novamente para continuar. Seus dados foram mantidos.',
        details: [],
        request_id: '',
      },
    });
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!response.ok) {
    const fallback: ErrorEnvelope = {
      error: {
        code: 'HTTP_ERROR',
        message: 'Não foi possível concluir a solicitação.',
        details: [],
        request_id: '',
      },
    };
    const body: unknown = await response.json().catch(() => fallback);
    const valid =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'message' in body.error &&
      typeof body.error.message === 'string' &&
      'code' in body.error &&
      typeof body.error.code === 'string' &&
      'details' in body.error &&
      Array.isArray(body.error.details);
    if (response.status === 401 && admin) clearAdminSession('unauthorized', token ?? undefined);
    throw new ApiError(response.status, valid ? (body as ErrorEnvelope) : fallback);
  }
  return response.json() as Promise<T>;
}

export function listProducts(filters: ProductFilters, signal?: AbortSignal): Promise<ProductPage> {
  return request(`/produtos?${serializeFilters(filters, true)}`, { method: 'GET', signal });
}

export function createProduct(product: CriarProduto): Promise<Produto> {
  return request(
    '/produtos',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    },
    true,
  );
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
