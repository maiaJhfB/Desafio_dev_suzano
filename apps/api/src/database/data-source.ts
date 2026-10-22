import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Produto, Pedido, ItemPedido } from './entities';
import { InitialSchema1761000000000 } from './initial-schema';
import { OrderIdempotency1792627200000 } from './order-idempotency';
config({
  path: [resolve(__dirname, '../../../../.env'), resolve(process.cwd(), '.env')],
  quiet: true,
});
export function databaseOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://catalogo:catalogo@localhost:5432/catalogo',
    entities: [Produto, Pedido, ItemPedido],
    migrations: [InitialSchema1761000000000, OrderIdempotency1792627200000],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: { max: 10, connectionTimeoutMillis: 5000 },
  };
}
export default new DataSource(databaseOptions());
