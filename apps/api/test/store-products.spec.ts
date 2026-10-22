import { readFileSync } from 'node:fs';
import { loadStoreProducts } from '../src/database/store-products';

jest.mock('node:fs', () => ({ ...jest.requireActual('node:fs'), readFileSync: jest.fn() }));

describe('Origem pública das imagens no seed compartilhado', () => {
  const originalOrigin = process.env.STORE_PUBLIC_ORIGIN;
  const fixture = (imageUrl: string | null = 'http://localhost:3000/store/report-a4.png') => [
    {
      id: '10000000-0000-4000-8000-000000000001',
      nome: 'Papel Report A4',
      categoria: 'Papel sulfite',
      descricao: 'Papel para impressão.',
      preco_centavos: 2990,
      quantidade_estoque: 5,
      imagem_url: imageUrl,
    },
  ];
  beforeEach(() => {
    delete process.env.STORE_PUBLIC_ORIGIN;
    jest.mocked(readFileSync).mockReturnValue(JSON.stringify(fixture()));
  });
  afterAll(() => {
    if (originalOrigin === undefined) delete process.env.STORE_PUBLIC_ORIGIN;
    else process.env.STORE_PUBLIC_ORIGIN = originalOrigin;
  });

  it('preserva a origem padrão quando nenhuma configuração é fornecida', () => {
    const products = loadStoreProducts('fixture.json');
    expect(products[0].imagem_url).toBe('http://localhost:3000/store/report-a4.png');
    expect(readFileSync).toHaveBeenCalledWith('fixture.json', 'utf8');
  });
  it('aplica STORE_PUBLIC_ORIGIN às imagens locais sem modificar os outros dados da fixture', () => {
    process.env.STORE_PUBLIC_ORIGIN = 'http://127.0.0.1:13000/';
    const products = loadStoreProducts('fixture.json');
    expect(products[0]).toEqual({
      ...fixture()[0],
      imagem_url: 'http://127.0.0.1:13000/store/report-a4.png',
    });
  });
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'remapeia o loopback %s preservando caminho e query',
    (hostname) => {
      jest
        .mocked(readFileSync)
        .mockReturnValue(
          JSON.stringify(fixture(`http://${hostname}:3000/store/report.png?size=2#preview`)),
        );
      const products = loadStoreProducts('fixture.json', 'https://loja.example.com');
      expect(products[0].imagem_url).toBe(
        'https://loja.example.com/store/report.png?size=2#preview',
      );
    },
  );
  it('preserva URLs externas e ausência de imagem', () => {
    const external = 'https://cdn.example.com/products/report.png?size=2';
    jest.mocked(readFileSync).mockReturnValue(JSON.stringify(fixture(external)));
    expect(loadStoreProducts('fixture.json', 'https://loja.example.com')[0].imagem_url).toBe(
      external,
    );
    jest.mocked(readFileSync).mockReturnValue(JSON.stringify(fixture(null)));
    expect(loadStoreProducts('fixture.json', 'https://loja.example.com')[0].imagem_url).toBeNull();
  });
  it.each([
    '',
    'not-a-url',
    'ftp://example.com',
    'http:example.com',
    'https://user:pass@example.com',
    'https://example.com/store',
    'https://example.com?size=2',
    'https://example.com#preview',
    ' https://example.com',
    `https://${'x'.repeat(2050)}.example.com`,
  ])('rejeita uma configuração de origem inválida: %s', (value) => {
    process.env.STORE_PUBLIC_ORIGIN = value;
    expect(() => loadStoreProducts('fixture.json')).toThrow(
      'STORE_PUBLIC_ORIGIN deve ser uma origem HTTP(S)',
    );
  });
});
