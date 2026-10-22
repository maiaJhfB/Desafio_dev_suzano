'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, PackagePlus, X } from 'lucide-react';
import { ApiError, createProduct } from '@/lib/api';
import { parseMoney } from '@/lib/money';
import { productSchema, type ProductFormValues } from '@/lib/product-schema';
import { useUI } from './providers';
import { useAuth } from '@/features/auth/auth-context';

const defaults: ProductFormValues = {
  nome: '',
  categoria: '',
  descricao: '',
  preco: '',
  imagem_url: '',
  quantidade_estoque: '',
};

export function ProductForm({ onCreated }: { onCreated: () => void }) {
  const { state, dispatch } = useUI();
  const auth = useAuth();
  const recoveryRequested = useRef(false);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: defaults });
  const mutation = useMutation({
    mutationFn: createProduct,
    retry: false,
    onSuccess: async (product) => {
      onCreated();
      await queryClient.invalidateQueries({ queryKey: ['produtos'] });
      dispatch({ type: 'notify', message: `“${product.nome}” foi cadastrado com sucesso.` });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          recoveryRequested.current = true;
          auth.requestAdmin(() => mutation.reset());
          return;
        }
        for (const detail of error.response.error.details ?? []) {
          const field = detail.field === 'preco_centavos' ? 'preco' : detail.field;
          if (field in defaults)
            setError(field as keyof ProductFormValues, { message: detail.reason });
        }
      }
    },
  });

  useEffect(() => {
    if (state.productDialog) {
      reset(defaults);
      mutation.reset();
    }
    // Reset only on opening; mutation state changes must preserve the user's input.
  }, [state.productDialog, reset]);

  useEffect(() => {
    if (!state.productDialog || auth.isAuthenticated) recoveryRequested.current = false;
    else if (!auth.loginOpen && !recoveryRequested.current) {
      recoveryRequested.current = true;
      auth.requestAdmin(() => mutation.reset());
    }
  }, [state.productDialog, auth.isAuthenticated, auth.loginOpen, auth.requestAdmin]);

  function submit(values: ProductFormValues) {
    const cents = parseMoney(values.preco);
    if (cents === null) return;
    mutation.mutate({
      nome: values.nome,
      categoria: values.categoria,
      descricao: values.descricao,
      imagem_url: values.imagem_url,
      preco_centavos: cents,
      quantidade_estoque: values.quantidade_estoque.trim() ? Number(values.quantidade_estoque) : 0,
    });
  }

  function errorProps(field: keyof ProductFormValues) {
    return {
      'aria-invalid': !!errors[field],
      'aria-describedby': errors[field] ? `${field}-error` : undefined,
    };
  }

  function errorMessage(field: keyof ProductFormValues) {
    return (
      errors[field] && (
        <span id={`${field}-error`} className="field-error">
          {errors[field]?.message}
        </span>
      )
    );
  }

  return (
    <Dialog.Root
      open={state.productDialog && !auth.loginOpen}
      onOpenChange={(open) => {
        if (!mutation.isPending) dispatch({ type: open ? 'open' : 'close' });
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onCloseAutoFocus={(event) => {
            if (auth.loginOpen) event.preventDefault();
          }}
        >
          <div className="dialog-header">
            <span className="dialog-icon">
              <PackagePlus size={24} aria-hidden="true" />
            </span>
            <Dialog.Close
              className="icon-button"
              aria-label="Fechar cadastro"
              disabled={mutation.isPending}
            >
              <X size={21} />
            </Dialog.Close>
            <Dialog.Title>Novo produto</Dialog.Title>
            <Dialog.Description>
              Uma nova boa escolha para o seu catálogo. Preencha os dados abaixo.
            </Dialog.Description>
          </div>
          <form onSubmit={handleSubmit(submit)} noValidate className="product-form">
            <p className="form-required">Todos os campos são obrigatórios, exceto o estoque.</p>
            <div className="field">
              <label htmlFor="nome">Nome do produto</label>
              <input
                id="nome"
                placeholder="Ex.: Luminária Arco"
                maxLength={120}
                {...register('nome')}
                {...errorProps('nome')}
              />
              {errorMessage('nome')}
            </div>
            <div className="field">
              <label htmlFor="categoria">Categoria</label>
              <input
                id="categoria"
                placeholder="Ex.: Iluminação"
                maxLength={80}
                {...register('categoria')}
                {...errorProps('categoria')}
              />
              {errorMessage('categoria')}
            </div>
            <div className="field">
              <label htmlFor="descricao">Descrição</label>
              <textarea
                id="descricao"
                rows={3}
                placeholder="O que torna esse produto especial?"
                maxLength={2000}
                {...register('descricao')}
                {...errorProps('descricao')}
              />
              {errorMessage('descricao')}
            </div>
            <div className="form-two-columns">
              <div className="field">
                <label htmlFor="preco">Preço</label>
                <div className="input-prefix">
                  <span aria-hidden="true">R$</span>
                  <input
                    id="preco"
                    placeholder="0,00"
                    inputMode="decimal"
                    {...register('preco')}
                    {...errorProps('preco')}
                  />
                </div>
                {errorMessage('preco')}
              </div>
              <div className="field">
                <label htmlFor="quantidade_estoque">
                  Estoque <span className="optional">(opcional)</span>
                </label>
                <input
                  id="quantidade_estoque"
                  placeholder="0"
                  inputMode="numeric"
                  {...register('quantidade_estoque')}
                  {...errorProps('quantidade_estoque')}
                />
                {errorMessage('quantidade_estoque')}
              </div>
            </div>
            <div className="field">
              <label htmlFor="imagem_url">URL da imagem</label>
              <input
                id="imagem_url"
                type="url"
                placeholder="https://exemplo.com/imagem.jpg"
                maxLength={2048}
                {...register('imagem_url')}
                {...errorProps('imagem_url')}
              />
              {errorMessage('imagem_url')}
              <span className="field-hint">Use o endereço completo de uma imagem pública.</span>
            </div>
            {mutation.isError && (
              <div role="alert" className="form-api-error">
                <strong>Não foi possível cadastrar.</strong>
                <span>
                  {mutation.error instanceof ApiError
                    ? mutation.error.message
                    : 'Confira sua conexão e tente novamente. Seus dados foram mantidos.'}
                </span>
              </div>
            )}
            {!auth.isAuthenticated && (
              <div className="form-api-error">
                <p>Sua sessão precisa ser renovada. Seus dados foram mantidos.</p>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => auth.requestAdmin(() => mutation.reset())}
                >
                  Entrar novamente
                </button>
              </div>
            )}
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={mutation.isPending}
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="button button-primary"
                disabled={mutation.isPending || !auth.isAuthenticated}
              >
                {mutation.isPending ? (
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                ) : (
                  <PackagePlus size={18} aria-hidden="true" />
                )}
                {mutation.isPending ? 'Cadastrando…' : 'Cadastrar produto'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
