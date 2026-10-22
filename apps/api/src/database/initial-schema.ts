import { MigrationInterface, QueryRunner } from 'typeorm';
export class InitialSchema1761000000000 implements MigrationInterface {
  name = 'InitialSchema1761000000000';
  async up(queryRunner: QueryRunner) {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(
      `CREATE TYPE status_pedido AS ENUM ('Pendente', 'Concluído', 'Cancelado')`,
    );
    await queryRunner.query(`CREATE TABLE produtos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(120) NOT NULL, categoria varchar(80) NOT NULL,
      descricao text NOT NULL, preco_centavos integer NOT NULL, quantidade_estoque integer NOT NULL,
      imagem_url varchar(2048), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), excluido_em timestamptz,
      CONSTRAINT ck_produtos_preco CHECK (preco_centavos BETWEEN 0 AND 100000000),
      CONSTRAINT ck_produtos_estoque CHECK (quantidade_estoque BETWEEN 0 AND 1000000)
    )`);
    await queryRunner.query('CREATE INDEX idx_produtos_nome ON produtos (nome)');
    await queryRunner.query(`CREATE TABLE pedidos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status status_pedido NOT NULL, total_pedido_centavos bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ck_pedidos_total CHECK (total_pedido_centavos >= 0)
    )`);
    await queryRunner.query(
      'CREATE INDEX idx_pedidos_status_created ON pedidos (status, created_at DESC)',
    );
    await queryRunner.query(`CREATE TABLE itens_pedido (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT, nome_produto varchar(120) NOT NULL,
      preco_unitario_centavos integer NOT NULL, quantidade integer NOT NULL, subtotal_centavos bigint NOT NULL,
      CONSTRAINT ck_itens_quantidade CHECK (quantidade BETWEEN 1 AND 10000),
      CONSTRAINT ck_itens_preco CHECK (preco_unitario_centavos >= 0),
      CONSTRAINT ck_itens_subtotal CHECK (subtotal_centavos = preco_unitario_centavos::bigint * quantidade),
      CONSTRAINT uq_itens_pedido_produto UNIQUE (pedido_id, produto_id)
    )`);
    await queryRunner.query('CREATE INDEX idx_itens_pedido ON itens_pedido (pedido_id)');
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query('DROP TABLE itens_pedido');
    await queryRunner.query('DROP TABLE pedidos');
    await queryRunner.query('DROP TABLE produtos');
    await queryRunner.query('DROP TYPE status_pedido');
  }
}
