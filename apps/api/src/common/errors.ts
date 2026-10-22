import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { DomainError, DomainErrorCode } from '../domain/errors';

const domainStatus: Record<DomainErrorCode, number> = {
  PRODUCT_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_ORDER_TRANSITION: 409,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  INVALID_PRICE_RANGE: 400,
  EMPTY_UPDATE: 400,
  DUPLICATE_PRODUCT: 400,
  ORDER_TOTAL_TOO_LARGE: 400,
};

export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
const publicCodes: Record<string, string> = {
  VALIDATION_ERROR: 'VALIDACAO_INVALIDA',
  INVALID_PRICE_RANGE: 'VALIDACAO_INVALIDA',
  EMPTY_UPDATE: 'VALIDACAO_INVALIDA',
  DUPLICATE_PRODUCT: 'VALIDACAO_INVALIDA',
  ORDER_TOTAL_TOO_LARGE: 'VALIDACAO_INVALIDA',
  PRODUCT_NOT_FOUND: 'PRODUTO_NAO_ENCONTRADO',
  ORDER_NOT_FOUND: 'PEDIDO_NAO_ENCONTRADO',
  INSUFFICIENT_STOCK: 'ESTOQUE_INSUFICIENTE',
  PRODUCT_UNAVAILABLE: 'PRODUTO_INDISPONIVEL',
  INVALID_ORDER_TRANSITION: 'TRANSICAO_INVALIDA',
  IDEMPOTENCY_KEY_CONFLICT: 'CHAVE_IDEMPOTENCIA_CONFLITANTE',
  TRANSACTION_CONFLICT: 'FALHA_TRANSITORIA',
  DATABASE_UNAVAILABLE: 'FALHA_TRANSITORIA',
  INTERNAL_ERROR: 'ERRO_INTERNO',
  NOT_FOUND: 'NAO_ENCONTRADO',
  HTTP_ERROR: 'ERRO_HTTP',
  INVALID_JSON: 'VALIDACAO_INVALIDA',
  PAYLOAD_TOO_LARGE: 'CORPO_MUITO_GRANDE',
  UNAUTHORIZED: 'NAO_AUTORIZADO',
  INVALID_CREDENTIALS: 'CREDENCIAIS_INVALIDAS',
  LOGIN_RATE_LIMIT: 'LIMITE_TENTATIVAS',
};
function normalizedDetails(details: unknown): { field: string; reason: string }[] {
  if (!details) return [];
  if (Array.isArray(details))
    return details.flatMap((item) => {
      if (typeof item === 'string') return [{ field: 'request', reason: item }];
      if (item && typeof item === 'object' && 'field' in item && 'reason' in item)
        return [{ field: String(item.field), reason: String(item.reason) }];
      return [];
    });
  return typeof details === 'object'
    ? Object.entries(details).map(([field, reason]) => ({ field, reason: String(reason) }))
    : [{ field: 'request', reason: String(details) }];
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Ocorreu um erro interno.';
    let details: unknown;
    if (error instanceof DomainError) {
      status = domainStatus[error.code];
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      const payload = error.getResponse();
      if (typeof payload === 'object' && payload) {
        const body = payload as { code?: string; message?: string | string[]; details?: unknown };
        code =
          body.code ??
          (status === 400 ? 'VALIDATION_ERROR' : status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR');
        message =
          typeof body.message === 'string' ? body.message : 'Os dados enviados são inválidos.';
        details = body.details ?? (Array.isArray(body.message) ? body.message : undefined);
      } else {
        message = payload;
        code = 'HTTP_ERROR';
      }
    } else if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.parse.failed'
    ) {
      status = 400;
      code = 'INVALID_JSON';
      message = 'O corpo da requisição deve conter JSON válido.';
    } else if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'O corpo da requisição excede o limite de 100 KB.';
    } else if (
      error instanceof QueryFailedError &&
      ['55P03', '40P01', '57014', '40001'].includes(
        (error.driverError as { code?: string }).code ?? '',
      )
    ) {
      status = 503;
      code = 'TRANSACTION_CONFLICT';
      message = 'Operação concorrente. Tente novamente.';
    } else {
      this.logger.error(
        JSON.stringify({
          event: 'request_failed',
          request_id: response.getHeader('x-request-id'),
          error_type: error instanceof Error ? error.name : 'Unknown',
        }),
      );
    }
    if (status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(status).json({
      error: {
        code: publicCodes[code] ?? code,
        message,
        details: normalizedDetails(details),
        request_id: response.getHeader('x-request-id') ?? request.headers['x-request-id'],
      },
    });
  }
}
