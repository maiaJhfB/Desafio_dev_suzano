import { randomBytes, scryptSync } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { parse } = require('dotenv');
const flags = new Set(process.argv.slice(2));
if ([...flags].some((flag) => !['--reset', '--test'].includes(flag)))
  throw new Error('Opções permitidas: --reset ou --test (somente GitHub Actions).');
const test = flags.has('--test');
if (test && (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV))
  throw new Error('--test só pode ser utilizado no ambiente descartável do GitHub Actions.');

const envPath = path.join(root, '.env');
const current = await readFile(envPath, 'utf8').catch(() =>
  readFile(path.join(root, '.env.example'), 'utf8'),
);
const configured = parse(current);
const reset = flags.has('--reset') || test;
const email =
  reset && test ? 'admin@suzano.local' : configured.AUTH_ADMIN_EMAIL || 'admin@suzano.local';
const password = test ? 'TesteJWT!2026' : `${randomBytes(18).toString('base64url')}!`;
const newPassword = reset || !configured.AUTH_ADMIN_PASSWORD_HASH;
const salt = randomBytes(16);
const passwordHash = newPassword
  ? `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`
  : configured.AUTH_ADMIN_PASSWORD_HASH;
const secret =
  reset || !configured.JWT_SECRET ? randomBytes(48).toString('base64url') : configured.JWT_SECRET;
if (Buffer.byteLength(secret, 'utf8') < 32)
  throw new Error(
    'JWT_SECRET precisa de ao menos 32 bytes. Use --reset para gerar outra configuração.',
  );
if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(passwordHash))
  throw new Error('AUTH_ADMIN_PASSWORD_HASH inválido. Use --reset para gerar outra configuração.');

const values = {
  AUTH_ADMIN_EMAIL: email,
  AUTH_ADMIN_PASSWORD_HASH: passwordHash,
  JWT_SECRET: secret,
};
let contents = current.trimEnd();
for (const [name, value] of Object.entries(values)) {
  // Compose interpolates $ in double-quoted dotenv values; the validated hash is literal.
  const encoded = name === 'AUTH_ADMIN_PASSWORD_HASH' ? `'${value}'` : JSON.stringify(value);
  const line = `${name}=${encoded}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  contents = pattern.test(contents)
    ? contents.replace(pattern, () => line)
    : `${contents}\n${line}`;
}
await writeFile(envPath, `${contents}\n`, { mode: 0o600 });

if (test) {
  for (const value of [secret, password, passwordHash]) console.log(`::add-mask::${value}`);
  await appendFile(
    process.env.GITHUB_ENV,
    Object.entries({ ...values, AUTH_TEST_ADMIN_PASSWORD: password })
      .map(([name, value]) => `${name}=${value}\n`)
      .join(''),
  );
  console.log('Autenticação configurada para os testes descartáveis da CI.');
} else {
  if (newPassword) {
    await mkdir(path.join(root, 'tmp'), { recursive: true });
    await writeFile(
      path.join(root, 'tmp', 'admin-access.json'),
      JSON.stringify({ email, password }, null, 2) + '\n',
      { mode: 0o600 },
    );
  }
  console.log(
    newPassword
      ? 'Autenticação configurada em .env. Credenciais locais: tmp/admin-access.json.'
      : 'Configuração de autenticação existente preservada. Use as credenciais já definidas.',
  );
  console.log(
    'A configuração existente é preservada; --reset troca a senha e a chave de assinatura.',
  );
}
