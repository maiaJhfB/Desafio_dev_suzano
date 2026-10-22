import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderIdempotency1792627200000 implements MigrationInterface {
  name = 'OrderIdempotency1792627200000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE TABLE pedido_idempotencia (
      chave uuid PRIMARY KEY,
      request_hash varchar(64) NOT NULL,
      pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      resposta jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ck_idempotencia_hash CHECK (request_hash ~ '^[0-9a-f]{64}$')
    )`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query('DROP TABLE pedido_idempotencia');
  }
}
