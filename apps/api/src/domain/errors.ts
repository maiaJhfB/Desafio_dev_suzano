export type DomainErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'PRODUCT_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_ORDER_TRANSITION'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'INVALID_PRICE_RANGE'
  | 'EMPTY_UPDATE'
  | 'DUPLICATE_PRODUCT'
  | 'ORDER_TOTAL_TOO_LARGE';

/** Business failures carry stable codes; HTTP status belongs to the transport adapter. */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
