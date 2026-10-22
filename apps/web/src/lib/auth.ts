import { z } from 'zod';
import { request } from './api';
import type { components } from '@catalogo/contracts';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe seu e-mail.')
    .max(254, 'Use até 254 caracteres.')
    .email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.').max(1024, 'Use até 1.024 caracteres.'),
});
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  role: z.literal('admin'),
});
const responseSchema = z.object({
  access_token: z
    .string()
    .min(1)
    .max(8192)
    .regex(/^[A-Za-z0-9._~-]+$/),
  token_type: z.literal('Bearer'),
  expires_in: z.literal(900),
  user: userSchema,
});
export type AdminUser = components['schemas']['AdminUserResponseDto'];
export type LoginCredentials = components['schemas']['LoginDto'];
export type LoginResponse = components['schemas']['LoginResponseDto'];

export async function loginAdmin(credentials: LoginCredentials): Promise<LoginResponse> {
  const result = await request<unknown>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginSchema.parse(credentials)),
  });
  const response = responseSchema.safeParse(result);
  if (!response.success)
    throw new Error('A resposta de autenticação não é válida. Tente entrar novamente.');
  return response.data;
}

export async function getAdminProfile(): Promise<AdminUser> {
  const result = await request<unknown>('/auth/me', { method: 'GET' }, true);
  const user = userSchema.safeParse(result);
  if (!user.success) throw new Error('A resposta do perfil administrativo não é válida.');
  return user.data;
}
