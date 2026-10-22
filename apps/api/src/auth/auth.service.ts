import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../common/errors';
import {
  ADMIN_ID,
  AUTH_CONFIG,
  AuthSettings,
  JWT_AUDIENCE,
  JWT_ISSUER,
  TOKEN_TTL_SECONDS,
} from './auth.config';
import { AdminUserResponseDto, LoginResponseDto } from './auth.dto';

interface AdminClaims {
  sub?: unknown;
  role?: unknown;
  email?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  aud?: unknown;
}

export function unauthorized(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Não autorizado. Faça login novamente.');
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, digest) => {
        if (error) reject(error);
        else resolve(digest);
      },
    );
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly settings: AuthSettings,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    // Always perform scrypt and the constant-time digest comparison, including unknown emails.
    const digest = await derivePassword(password, this.settings.passwordSalt);
    const passwordMatches = timingSafeEqual(digest, this.settings.passwordDigest);
    if (email !== this.settings.email || !passwordMatches) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
    }
    const access_token = await this.jwt.signAsync(
      { email: this.settings.email, role: 'admin' },
      {
        secret: this.settings.secret,
        algorithm: 'HS256',
        expiresIn: TOKEN_TTL_SECONDS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        subject: ADMIN_ID,
      },
    );
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      user: this.adminUser(),
    };
  }

  async authenticate(header: unknown): Promise<AdminUserResponseDto> {
    if (typeof header !== 'string' || header.length > 8192) throw unauthorized();
    const matched = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
    if (!matched) throw unauthorized();
    try {
      const claims = await this.jwt.verifyAsync<AdminClaims>(matched[1], {
        secret: this.settings.secret,
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        ignoreExpiration: false,
        clockTolerance: 0,
        maxAge: TOKEN_TTL_SECONDS,
      });
      const now = Math.floor(Date.now() / 1000);
      if (
        claims.sub !== ADMIN_ID ||
        claims.role !== 'admin' ||
        claims.email !== this.settings.email ||
        claims.iss !== JWT_ISSUER ||
        claims.aud !== JWT_AUDIENCE ||
        typeof claims.exp !== 'number' ||
        !Number.isInteger(claims.exp) ||
        typeof claims.iat !== 'number' ||
        !Number.isInteger(claims.iat) ||
        claims.iat > now ||
        claims.exp <= now ||
        claims.exp <= claims.iat ||
        claims.exp - claims.iat > TOKEN_TTL_SECONDS
      )
        throw unauthorized();
      return this.adminUser();
    } catch {
      throw unauthorized();
    }
  }

  private adminUser(): AdminUserResponseDto {
    return { id: ADMIN_ID, email: this.settings.email, role: 'admin' };
  }
}
