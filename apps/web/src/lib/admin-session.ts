/** The access token exists only in this client module's memory. Never persist it. */
let session: { token: string; expiresAt: number } | null = null;
type InvalidationReason = 'expired' | 'unauthorized' | 'logout';
const listeners = new Set<(reason: InvalidationReason) => void>();

export function setAdminSession(token: string, expiresAt: number): void {
  session = { token, expiresAt };
}

export function clearAdminSession(
  reason: InvalidationReason = 'logout',
  expectedToken?: string,
): void {
  if (expectedToken && session?.token !== expectedToken) return;
  session = null;
  for (const listener of listeners) listener(reason);
}

export function getAdminAccessToken(): string | null {
  if (session && session.expiresAt <= Date.now()) clearAdminSession('expired');
  return session?.token ?? null;
}

export function onAdminSessionInvalidated(
  listener: (reason: InvalidationReason) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
