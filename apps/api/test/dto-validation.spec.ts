import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePedidoDto } from '../src/pedidos/pedidos.dto';
import { IdempotencyKeyPipe } from '../src/pedidos/idempotency-key.pipe';

const item = { produto_id: '10000000-0000-4000-8000-000000000001', quantidade: 1 };
const validatePedido = (payload: unknown) =>
  validateSync(plainToInstance(CreatePedidoDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

describe('Validação de fronteira dos pedidos', () => {
  it.each([
    { produtos: [[]] },
    { produtos: [[item]] },
    { produtos: [null] },
    { produtos: [1] },
    { produtos: ['produto'] },
  ])('rejeita itens que não são objetos planos: %j', (payload) => {
    expect(validatePedido(payload).length).toBeGreaterThan(0);
  });

  it('permite omitir status e rejeita null explicitamente', () => {
    expect(validatePedido({ produtos: [item] })).toHaveLength(0);
    const errors = validatePedido({ produtos: [item], status: null });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'status',
          constraints: expect.objectContaining({ isIn: expect.any(String) }),
        }),
      ]),
    );
  });

  it('normaliza UUIDs antes de rejeitar produtos repetidos', () => {
    const id = 'a0000000-abcd-4000-8000-000000000001';
    const errors = validatePedido({
      produtos: [
        { ...item, produto_id: id },
        { ...item, produto_id: id.toUpperCase() },
      ],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'produtos',
          constraints: expect.objectContaining({ arrayUnique: expect.any(String) }),
        }),
      ]),
    );
  });
});

describe('Idempotency-Key', () => {
  const pipe = new IdempotencyKeyPipe();
  it('é opcional e normaliza um UUID válido', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform('A0000000-ABCD-4000-8000-000000000001')).toBe(
      'a0000000-abcd-4000-8000-000000000001',
    );
  });
  it.each([
    '',
    'not-a-uuid',
    '10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002',
    null,
    [],
  ])('rejeita um cabeçalho malformado: %j', (value) => {
    expect(() => pipe.transform(value)).toThrow('Idempotency-Key deve ser um UUID válido.');
  });
});
