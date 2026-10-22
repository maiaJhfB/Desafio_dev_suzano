import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setInterval } from 'node:timers';
import EmbeddedPostgres from 'embedded-postgres';

// Alternativa de desenvolvimento; nunca cria usuário no sistema operacional.
const databaseDir = resolve('.local-postgres');
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'catalogo',
  password: 'catalogo',
  port: 5432,
  persistent: true,
  createPostgresUser: false,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (error) => console.error(String(error)),
});
try {
  await access(resolve(databaseDir, 'PG_VERSION'));
} catch {
  await pg.initialise();
}
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ['catalogo', 'catalogo_test']) {
  const found = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
  if (!found.rowCount) await pg.createDatabase(name);
}
await client.end();
console.log('PostgreSQL local pronto em 127.0.0.1:5432. Bancos catalogo e catalogo_test.');
console.log('Mantenha este terminal aberto; Ctrl+C encerra o servidor e preserva os dados.');
setInterval(() => {}, 60_000);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await pg.stop();
    process.exit(0);
  });
