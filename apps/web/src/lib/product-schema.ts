import { z } from 'zod';
import { parseMoney } from './money';

export const productSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do produto.').max(120, 'Use até 120 caracteres.'),
  categoria: z.string().trim().min(1, 'Informe uma categoria.').max(80, 'Use até 80 caracteres.'),
  descricao: z.string().trim().min(1, 'Descreva o produto.').max(2000, 'Use até 2.000 caracteres.'),
  preco: z.string().refine((value) => {
    const cents = parseMoney(value);
    return cents !== null && cents >= 0;
  }, 'Informe um preço entre 0 e 1.000.000,00. Ex.: 129,90.'),
  imagem_url: z
    .string()
    .trim()
    .max(2048, 'A URL deve ter até 2.048 caracteres.')
    .url('Informe uma URL válida para a imagem.')
    .refine((value) => {
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    }, 'Use um endereço HTTP(S) sem usuário ou senha.'),
  quantidade_estoque: z
    .string()
    .refine(
      (value) => value.trim() === '' || (/^\d+$/.test(value) && Number(value) <= 1000000),
      'Informe um número inteiro de 0 a 1.000.000.',
    ),
});

export type ProductFormValues = z.infer<typeof productSchema>;
