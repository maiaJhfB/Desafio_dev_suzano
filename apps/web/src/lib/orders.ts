import type { components } from '@catalogo/contracts';
import { apiBaseUrl, ApiError } from './api';
import type { ErrorEnvelope } from './types';

export type Order = components['schemas']['PedidoResponseDto'];
export type OrderItemInput = components['schemas']['ItemPedidoDto'];

/** Retries of one logical purchase carry the same key, including after a lost response. */
export async function createOrder(items: OrderItemInput[], idempotencyKey: string): Promise<Order> {
  const response = await fetch(`${apiBaseUrl}/pedidos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ produtos: items, status: 'Pendente' }),
  });

  if (!response.ok) {
    const fallback: ErrorEnvelope = {
      error: {
        code: 'HTTP_ERROR',
        message: 'Não foi possível finalizar o pedido. Seu carrinho foi mantido.',
        details: [],
        request_id: '',
      },
    };
    const body: ErrorEnvelope = await response.json().catch(() => fallback);
    throw new ApiError(response.status, body?.error?.message ? body : fallback);
  }

  const order: Order = await response.json();
  if (
    !order ||
    typeof order.id !== 'string' ||
    !order.id ||
    !['Pendente', 'Concluído', 'Cancelado'].includes(order.status) ||
    !Number.isSafeInteger(order.total_pedido_centavos) ||
    order.total_pedido_centavos < 0
  ) {
    throw new Error('A confirmação recebida não é válida. Seu carrinho foi mantido.');
  }
  return order;
}
