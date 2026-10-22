import { loginAdmin } from '@/lib/auth';
import { setAdminSession } from '@/lib/admin-session';
import { mockAdminCredentials } from '@/mocks/handlers';
export async function authorizeMock() {
  const session = await loginAdmin(mockAdminCredentials);
  setAdminSession(session.access_token, Date.now() + session.expires_in * 1000);
  return session.access_token;
}
