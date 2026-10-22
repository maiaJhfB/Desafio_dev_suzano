import { ProdutosService } from '../src/produtos/produtos.service';
import { ProdutosStore } from '../src/produtos/produtos.ports';
import { ListProdutosDto } from '../src/produtos/produtos.dto';
describe('ProdutosService', () => {
  const fakeStore = (): jest.Mocked<ProdutosStore> => ({
    list: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });
  it('rejeita faixa de preço invertida antes de consultar banco', async () => {
    const repository = fakeStore();
    await expect(
      new ProdutosService(repository).list(
        Object.assign(new ListProdutosDto(), { preco_min_centavos: 200, preco_max_centavos: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PRICE_RANGE' });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('calcula paginação de conjunto vazio sem inventar páginas', async () => {
    const repository = fakeStore();
    repository.list.mockResolvedValue([[], 0]);
    await expect(new ProdutosService(repository).list(new ListProdutosDto())).resolves.toEqual({
      data: [],
      meta: { pagina: 1, limite: 12, total: 0, total_paginas: 0 },
    });
  });
});
