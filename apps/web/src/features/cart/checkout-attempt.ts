import type { OrderItemInput } from '@/lib/orders';

interface CheckoutAttempt {
  signature: string;
  key: string;
}
const storageKey = 'suzano-store-checkout-attempt-v1';

export function orderSignature(items: OrderItemInput[]): string {
  return JSON.stringify([...items].sort((a, b) => a.produto_id.localeCompare(b.produto_id)));
}

export function readCheckoutAttempt(signature: string): CheckoutAttempt | null {
  try {
    const candidate: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
    if (
      candidate &&
      typeof candidate === 'object' &&
      'signature' in candidate &&
      'key' in candidate &&
      candidate.signature === signature &&
      typeof candidate.key === 'string' &&
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(candidate.key)
    )
      return candidate as CheckoutAttempt;
  } catch {
    /* The in-memory attempt still protects retries when storage is unavailable. */
  }
  return null;
}

export function newCheckoutAttempt(signature: string): CheckoutAttempt {
  const attempt = { signature, key: window.crypto.randomUUID() };
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    /* Storage is optional. */
  }
  return attempt;
}

export function clearCheckoutAttempt(): void {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    /* Storage is optional. */
  }
}
