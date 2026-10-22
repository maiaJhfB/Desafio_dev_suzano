import { PedidosService } from '../src/pedidos/pedidos.service';
import { PedidosStore, PedidoTransaction } from '../src/pedidos/pedidos.ports';
import { Pedido, Produto, StatusPedido } from '../src/database/entities';
const product = (id: string, price: number, stock: number) =>
  ({ id, nome: `Produto ${id}`, preco_centavos: price, quantidade_estoque: stock }) as Produto;
describe('PedidosService — regras de negócio', () => {
  let transaction: jest.Mocked<PedidoTransaction>;
  let service: PedidosService;
  beforeEach(() => {
    transaction = {
      lockCreationKey: jest.fn(),
      saveCreationReplay: jest.fn(),
      lockProdutos: jest.fn(),
      lockPedido: jest.fn(),
      saveProdutos: jest.fn(),
      createPedido: jest.fn(),
      savePedido: jest.fn(),
    };
    const store = {
      transaction: <T>(work: (tx: PedidoTransaction) => Promise<T>) => work(transaction),
    } as PedidosStore;
    service = new PedidosService(store);
  });
  it('valida estoque do pendente, calcula snapshots e total sem baixar estoque', async () => {
    const products = [product('b', 299, 4), product('a', 1050, 3)];
    transaction.lockProdutos.mockResolvedValue(products);
    await service.create({
      produtos: [
        { produto_id: 'b', quantidade: 3 },
        { produto_id: 'a', quantidade: 2 },
      ],
    });
    expect(transaction.lockProdutos).toHaveBeenCalledWith(['a', 'b']);
    expect(transaction.createPedido).toHaveBeenCalledWith(StatusPedido.Pendente, 2997, [
      {
        produto_id: 'a',
        nome_produto: 'Produto a',
        preco_unitario_centavos: 1050,
        quantidade: 2,
        subtotal_centavos: 2100,
      },
      {
        produto_id: 'b',
        nome_produto: 'Produto b',
        preco_unitario_centavos: 299,
        quantidade: 3,
        subtotal_centavos: 897,
      },
    ]);
    expect(transaction.saveProdutos).not.toHaveBeenCalled();
    expect(products.map((p) => p.quantidade_estoque)).toEqual([4, 3]);
  });
  it('rejeita todo o pedido antes de salvar quando um item não tem estoque', async () => {
    transaction.lockProdutos.mockResolvedValue([product('a', 100, 5), product('b', 900, 0)]);
    await expect(
      service.create({
        status: StatusPedido.Concluido,
        produtos: [
          { produto_id: 'a', quantidade: 2 },
          { produto_id: 'b', quantidade: 1 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(transaction.saveProdutos).not.toHaveBeenCalled();
    expect(transaction.createPedido).not.toHaveBeenCalled();
  });
  it('concluir novamente é idempotente e não consulta nem baixa estoque', async () => {
    const pedido = { id: 'pedido', status: StatusPedido.Concluido, itens: [] } as unknown as Pedido;
    transaction.lockPedido.mockResolvedValue(pedido);
    await expect(service.updateStatus('pedido', { status: StatusPedido.Concluido })).resolves.toBe(
      pedido,
    );
    expect(transaction.lockProdutos).not.toHaveBeenCalled();
    expect(transaction.savePedido).not.toHaveBeenCalled();
  });
  it('finaliza pendente usando preço histórico mesmo se o produto mudou', async () => {
    const pedido = {
      id: 'pedido',
      status: StatusPedido.Pendente,
      total_pedido_centavos: 100,
      itens: [
        { produto_id: 'a', quantidade: 1, preco_unitario_centavos: 100, subtotal_centavos: 100 },
      ],
    } as Pedido;
    transaction.lockPedido.mockResolvedValue(pedido);
    transaction.lockProdutos.mockResolvedValue([product('a', 99900, 5)]);
    transaction.savePedido.mockImplementation(async (value) => value);
    const result = await service.updateStatus('pedido', { status: StatusPedido.Concluido });
    expect(result.total_pedido_centavos).toBe(100);
    expect(result.itens[0].preco_unitario_centavos).toBe(100);
    expect(transaction.saveProdutos).toHaveBeenCalledWith([
      expect.objectContaining({ quantidade_estoque: 4 }),
    ]);
  });
  it('rejeita mudança de concluído para cancelado', async () => {
    transaction.lockPedido.mockResolvedValue({ status: StatusPedido.Concluido } as Pedido);
    await expect(
      service.updateStatus('pedido', { status: StatusPedido.Cancelado }),
    ).rejects.toMatchObject({ code: 'INVALID_ORDER_TRANSITION' });
  });
  it('registra a criação e repete a mesma resposta sem reler produtos ou baixar estoque', async () => {
    const pedido = { id: 'pedido', status: StatusPedido.Pendente, itens: [] } as unknown as Pedido;
    transaction.lockCreationKey.mockResolvedValue(null);
    transaction.lockProdutos.mockResolvedValue([product('a', 100, 3), product('b', 200, 2)]);
    transaction.createPedido.mockResolvedValue(pedido);
    const key = '10000000-0000-4000-8000-000000000001';
    const created = await service.create(
      {
        produtos: [
          { produto_id: 'b', quantidade: 1 },
          { produto_id: 'a', quantidade: 2 },
        ],
      },
      key,
    );
    expect(created).toEqual({ pedido, replayed: false });
    expect(transaction.saveCreationReplay).toHaveBeenCalledWith(
      key,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      pedido,
    );
    const hash = transaction.saveCreationReplay.mock.calls[0][1];
    transaction.lockCreationKey.mockResolvedValue({ requestHash: hash, pedido });
    transaction.lockProdutos.mockClear();
    transaction.saveProdutos.mockClear();
    transaction.createPedido.mockClear();
    const replay = await service.create(
      {
        status: StatusPedido.Pendente,
        produtos: [
          { produto_id: 'a', quantidade: 2 },
          { produto_id: 'b', quantidade: 1 },
        ],
      },
      key,
    );
    expect(replay).toEqual({ pedido, replayed: true });
    expect(transaction.lockProdutos).not.toHaveBeenCalled();
    expect(transaction.saveProdutos).not.toHaveBeenCalled();
    expect(transaction.createPedido).not.toHaveBeenCalled();
  });
  it('rejeita chave reutilizada com conteúdo diferente antes de buscar estoque', async () => {
    transaction.lockCreationKey.mockResolvedValue({
      requestHash: 'a'.repeat(64),
      pedido: { id: 'pedido' } as Pedido,
    });
    await expect(
      service.create(
        { produtos: [{ produto_id: 'a', quantidade: 1 }] },
        '10000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
    expect(transaction.lockProdutos).not.toHaveBeenCalled();
    expect(transaction.createPedido).not.toHaveBeenCalled();
  });
});
