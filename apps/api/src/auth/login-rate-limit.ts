import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from '../common/errors';

export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_MS = 60_000;
export const LOGIN_RATE_MAX_IPS = 1024;

@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();

  /** Returns a Retry-After value when denied. Entries expire; active entries are never evicted. */
  consume(ip: string, now = Date.now()): number | undefined {
    for (const [key, entry] of this.attempts) if (entry.expiresAt <= now) this.attempts.delete(key);
    let entry = this.attempts.get(ip);
    if (!entry) {
      if (this.attempts.size >= LOGIN_RATE_MAX_IPS) {
        const nextExpiry = Math.min(
          ...Array.from(this.attempts.values(), (value) => value.expiresAt),
        );
        return Math.max(1, Math.ceil((nextExpiry - now) / 1000));
      }
      entry = { count: 0, expiresAt: now + LOGIN_RATE_WINDOW_MS };
      this.attempts.set(ip, entry);
    }
    if (entry.count >= LOGIN_RATE_LIMIT)
      return Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    entry.count += 1;
    return undefined;
  }
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: LoginRateLimiter) {}
  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    // Express does not trust proxy headers by default; do not read X-Forwarded-For directly.
    const retryAfter = this.limiter.consume(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
    if (retryAfter !== undefined) {
      http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
      throw new ApiError(
        429,
        'LOGIN_RATE_LIMIT',
        'Muitas tentativas de login. Tente novamente mais tarde.',
      );
    }
    return true;
  }
}
