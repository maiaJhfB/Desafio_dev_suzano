import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  OpenAPIObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { setupApp } from '../src/app.setup';
import { PedidosController } from '../src/pedidos/pedidos.controller';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { ProdutosController } from '../src/produtos/produtos.controller';
import { ProdutosService } from '../src/produtos/produtos.service';

@Module({
  controllers: [ProdutosController, PedidosController],
  providers: [
    { provide: ProdutosService, useValue: {} },
    { provide: PedidosService, useValue: {} },
  ],
})
class DocumentationModule {}

describe('Contrato OpenAPI gerado pelos controllers', () => {
  let app: INestApplication;
  let document: OpenAPIObject;
  const schema = (name: string) => document.components?.schemas?.[name] as SchemaObject;
  beforeAll(async () => {
    // Generate the actual API contract without a database or a listening HTTP server.
    app = await NestFactory.create(DocumentationModule, { logger: false, bodyParser: false });
    document = setupApp(app);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('descreve centavos, estoque e quantidade como inteiros com os limites da validação', () => {
    expect(schema('CreateProdutoDto').properties).toMatchObject({
      preco_centavos: { type: 'integer', minimum: 0, maximum: 100000000 },
      quantidade_estoque: { type: 'integer', minimum: 0, maximum: 1000000 },
    });
    expect(schema('ItemPedidoDto').properties?.quantidade).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 10000,
    });
  });
  it('documenta textos não vazios e status opcional sem permitir null', () => {
    expect(schema('CreateProdutoDto').properties).toMatchObject({
      nome: { minLength: 1, maxLength: 120, pattern: '\\S' },
      categoria: { minLength: 1, maxLength: 80, pattern: '\\S' },
      descricao: { minLength: 1, maxLength: 2000, pattern: '\\S' },
    });
    expect(schema('CreatePedidoDto').properties?.status).toMatchObject({
      nullable: false,
      enum: ['Pendente', 'Concluído'],
    });
    expect(schema('CreatePedidoDto').required).not.toContain('status');
  });
  it('documenta a chave opcional e o cabeçalho que identifica replay', () => {
    const operation = document.paths['/api/v1/pedidos'].post!;
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        }),
      ]),
    );
    expect(operation.responses['201']).toMatchObject({
      headers: { 'Idempotency-Replayed': { schema: { enum: ['true', 'false'] } } },
    });
  });
});
