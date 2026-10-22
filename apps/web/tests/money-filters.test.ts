import { parseMoney } from '@/lib/money';
import { parseFilters, serializeFilters } from '@/lib/filters';
import { productSchema } from '@/lib/product-schema';

test('converte centavos sem arredondamento de ponto flutuante e rejeita entrada ambígua', () => {
  expect(parseMoney('1.234,56')).toBe(123456);
  expect(parseMoney('0,01')).toBe(1);
  expect(parseMoney('0')).toBe(0);
  for (const input of ['12,345', '1.23', '-1', '1000000,01', 'abc', ''])
    expect(parseMoney(input)).toBeNull();
});
test('normaliza URL inválida e preserva filtros combinados no roundtrip', () => {
  const filters = parseFilters(
    new URLSearchParams(
      'nome= cadeira &preco_min_centavos=100&preco_max_centavos=500&ordenar=preco&direcao=asc&pagina=2',
    ),
  );
  expect(filters).toMatchObject({
    nome: 'cadeira',
    preco_min_centavos: 100,
    preco_max_centavos: 500,
    pagina: 2,
  });
  expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  expect(
    parseFilters(
      new URLSearchParams('pagina=-2&ordenar=sql&preco_min_centavos=500&preco_max_centavos=100'),
    ),
  ).toMatchObject({ pagina: 1, ordenar: 'criado_em', preco_min_centavos: undefined });
});
test('formulário aceita zero mas exige URL HTTP sem credenciais', () => {
  const input = {
    nome: 'A',
    categoria: 'B',
    descricao: 'C',
    preco: '0,00',
    quantidade_estoque: '',
    imagem_url: 'https://example.com/a.png',
  };
  expect(productSchema.safeParse(input).success).toBe(true);
  expect(
    productSchema.safeParse({ ...input, imagem_url: 'https://user:pass@example.com/a.png' })
      .success,
  ).toBe(false);
});
