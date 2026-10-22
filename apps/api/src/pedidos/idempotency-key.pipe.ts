import { createParamDecorator, ExecutionContext, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ApiError } from '../common/errors';

@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<unknown, string | undefined> {
  transform(value: unknown) {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !isUUID(value)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Idempotency-Key deve ser um UUID válido.', [
        { field: 'Idempotency-Key', reason: 'Informe um UUID válido ou omita o cabeçalho.' },
      ]);
    }
    return value.toLowerCase();
  }
}

export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const header: unknown = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>()
    .headers['idempotency-key'];
  return new IdempotencyKeyPipe().transform(header);
});
