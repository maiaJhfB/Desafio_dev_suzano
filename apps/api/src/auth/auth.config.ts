import { isEmail } from 'class-validator';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const ADMIN_ID = '20000000-0000-4000-8000-000000000001';
export const JWT_ISSUER = 'loja-suzano-api';
export const JWT_AUDIENCE = 'loja-suzano-admin';
export const TOKEN_TTL_SECONDS = 900;

export interface AuthSettings {
  secret: string;
  email: string;
  passwordSalt: Buffer;
  passwordDigest: Buffer;
}

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthSettings {
  const secret = env.JWT_SECRET;
  if (!secret || !secret.trim() || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET é obrigatório e precisa conter pelo menos 32 bytes.');
  }
  const email = env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || email.length > 254 || !isEmail(email)) {
    throw new Error('AUTH_ADMIN_EMAIL é obrigatório e precisa ser um email válido.');
  }
  const hash = env.AUTH_ADMIN_PASSWORD_HASH;
  const matched =
    typeof hash === 'string' ? /^scrypt\$([0-9a-f]{32})\$([0-9a-f]{128})$/i.exec(hash) : null;
  if (!matched) {
    throw new Error(
      'AUTH_ADMIN_PASSWORD_HASH é obrigatório no formato scrypt$<salt32hex>$<digest128hex>.',
    );
  }
  return {
    secret,
    email,
    passwordSalt: Buffer.from(matched[1], 'hex'),
    passwordDigest: Buffer.from(matched[2], 'hex'),
  };
}
