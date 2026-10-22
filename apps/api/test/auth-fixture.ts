import { scryptSync } from 'node:crypto';
export const authEmail = 'admin@suzano.local';
export const authPassword = 'TesteJWT!2026';
export const authSecret = 'isolated-test-jwt-secret-32-bytes-minimum';
export function configureAuthTests() {
  const salt = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
  const digest = scryptSync(authPassword, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  Object.assign(process.env, {
    JWT_SECRET: authSecret,
    AUTH_ADMIN_EMAIL: authEmail,
    AUTH_ADMIN_PASSWORD_HASH: `scrypt$${salt.toString('hex')}$${digest.toString('hex')}`,
  });
}
