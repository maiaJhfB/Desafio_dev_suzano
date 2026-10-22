# Evidências de verificação

Data da revisão: **22/10/2026**. Ambiente local: Windows, Node **24.19.0**, pnpm **11.25.0**, PostgreSQL **18.4** real e Chromium do Playwright fixado no lockfile. Docker Desktop **4.96.2**, Engine **29.9.2** e Compose **5.6.1**, com containers Linux, também foram utilizados. A entrega inclui catálogo Suzano, cadastro, filtros, paginação, detalhes, carrinho e checkout demonstrativo.

## Resultados locais da revisão

| Verificação                                               | Resultado                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                          | Instalação reproduzida sem alterar dependências ou lockfile            |
| `pnpm typecheck`                                          | Três áreas sem erros, inclusive após gerar os contratos finais         |
| `pnpm lint`                                               | Sem erros ou avisos                                                    |
| `pnpm format:check`                                       | Todos os arquivos aprovados                                            |
| `pnpm test:unit`                                          | **101 aprovados:** 67 backend em 6 suítes e 34 frontend em 7 suítes    |
| `TEST_DATABASE_URL=…/catalogo_test pnpm test:integration` | **18 aprovados**, com PostgreSQL real                                  |
| Integração sem `TEST_DATABASE_URL`                        | Saída 1 com orientação explícita, sem conectar ou pular testes         |
| `pnpm test:e2e`                                           | **9 aprovados**, incluindo snapshot Windows, teclado e viewport 360 px |
| `pnpm test:e2e:integrated`                                | **2 aprovados**, com API compilada e PostgreSQL reais                  |
| Build da API e `pnpm --filter @catalogo/web build`        | Ambos aprovados                                                        |
| `pnpm db:migrate` e `pnpm db:seed`                        | Nova migration aplicada e 16 produtos Suzano conferidos                |
| `pnpm contracts:generate` e `pnpm contracts:check`        | OpenAPI exportado, tipos gerados e respostas reais validadas           |

Total de **130 testes distintos aprovados**: 67 backend, 34 frontend, 18 integrações e 11 cenários de navegador, além do smoke Docker completo. O snapshot integra um dos nove cenários mock e não é contado novamente. Esse número não representa uma medição percentual de cobertura.

## Correções verificadas

- **JWT:** login válido/inválido, assinatura, algoritmo, emissor, audiência, expiração e claims obrigatórias; configuração ausente impede iniciar a API. Limite de login e cabeçalho CORS são exercitados por HTTP.
- **Autorização:** escritas de produtos, leitura de pedidos e conclusão exigem token; checkout pendente sem token continua funcional. PostgreSQL real confirma o limite entre visitante e administrador sem alterar as regras de estoque.
- **Sessão da interface:** login/logout, recarga, expiração e recuperação após 401 preservam o cadastro. Tokens não ficam no armazenamento persistente. Testes reais desativam traces, vídeos e capturas de falha com credenciais.

- **Validação:** itens aninhados, nulos ou primitivos e `status: null` são rejeitados. UUIDs são normalizados antes de verificar duplicatas; PATCH não permite nulos em campos obrigatórios.
- **Swagger:** entradas monetárias, estoque e quantidades são inteiros, com limites explícitos; textos obrigatórios indicam conteúdo não vazio. A chave opcional e o cabeçalho de replay estão documentados.
- **Idempotência:** duas chamadas simultâneas com a mesma chave criam um único pedido e uma única baixa. Replay preserva a resposta original mesmo após editar o produto ou mudar o status. Conteúdo diferente retorna 409; falhas de negócio e rollback não consomem a chave.
- **Estoque:** duas compras disputando a última unidade deixam uma vencedora; concluir o mesmo pedido simultaneamente baixa uma vez. Falha forçada após alterar dois produtos desfaz a operação inteira.
- **Domínio:** modelos, comandos e erros não importam NestJS, TypeORM ou DTOs. Serviços e portas usam os tipos de domínio; o transporte traduz os erros para HTTP.
- **Carrinho:** o feedback distingue inclusão, estoque esgotado e limites. Os testes verificam o limite de 100 produtos e o máximo de quantidade, preservação após falha e limpeza após confirmação.
- **Resposta perdida:** o frontend mantém a chave em memória e na sessão da aba. Testes verificam nova tentativa, reabertura, remontagem com hidratação inicial vazia e renovação após alterar itens ou confirmar a compra. MSW implementa replay e conflito do mesmo contrato.
- **Foco e responsividade:** Escape devolve o foco ao título ou imagem que abriu os detalhes; cadastro e carrinho também restauram o foco. O viewport de 360 px permanece sem transbordamento horizontal.
- **Organização visual:** catálogo separado em cabeçalho, apresentação, resultados e rodapé; estilos divididos por responsabilidade. O snapshot passou contra a baseline existente, sem atualizá-la.
- **Documentação:** README inclui clonagem, modos mock/real, banco, exemplo de ID do seed, pré-requisitos dos testes, diferença entre visual Windows e funcional Linux e comandos Docker em segundo plano.
- **Imagens em outras portas:** `STORE_PUBLIC_ORIGIN` configura a origem pública do seed sem alterar imagens externas ou registros existentes. Testes cobrem origem padrão, loopback, configuração inválida e preservação dos dados. O smoke exige que as 12 imagens dos cards carreguem, sem aceitar o fallback como sucesso.

## Docker e integração contínua

As imagens usam etapas separadas de build e execução, usuário `node`, dependências de produção e Next standalone. Migrations e seed executam JavaScript compilado. O pacote de produção da API foi validado: NestJS, TypeORM e PostgreSQL disponíveis; TypeScript, ts-node e Jest ausentes.

O teste completo com JWT passou no Docker Desktop local com `node scripts/docker-smoke.mjs --local`, inclusive após corrigir a origem das imagens e exigir seu carregamento. Foram usados banco e portas separados do desenvolvimento; os containers e volumes temporários foram removidos ao terminar.

A [validação remota do commit 530f7e2](https://github.com/maiaJhfB/Desafio_dev_suzano/actions/runs/39868650790) aprovou os três jobs: aplicação Linux, visual Windows e Docker com compra real e autenticação administrativa. Foram aprovados os 130 testes distintos, além do smoke Docker. O empacotamento usa lockfile derivado congelado, mantendo versões e integridades das dependências. Este registro foi atualizado após a aprovação, sem alterações adicionais na implementação.

O smoke cria um projeto Compose aleatório e descartável, compila as imagens, aguarda healthchecks, migra, executa seed e verifica usuário sem privilégios, dependências, Swagger, login, bloqueios sem JWT, CRUD autenticado, estoque, imagens, checkout público e login/logout no navegador sem service worker. Logs, status e capturas são publicados no artefato `smoke-docker` na CI, ou em `tmp/docker-smoke/` localmente. A limpeza remove somente os volumes desse projeto. Na CI, esse smoke usa o Chrome já incluído no runner Ubuntu, evitando reinstalar dependências do navegador; a execução local usa Chromium por padrão.

Os outros jobs executam verificações estáticas, testes com PostgreSQL e navegador em Linux e comparação visual em Windows. Baselines nunca são atualizadas automaticamente.

## Imagens e identidade

Baseline: `apps/web/tests/e2e/catalog.spec.ts-snapshots/catalogo-chromium-win32.png`. Seed, fontes, imagens, viewport e animações são controlados; a comparação aguarda imagens e fontes. As capturas da revisão visual original permanecem ilustrativas do layout preservado:

- [Loja desktop, 1366 × 1000](preview/suzano-desktop.png).
- [Loja mobile, 360 × 800](preview/suzano-mobile.png).
- [Carrinho mobile, 360 × 800](preview/suzano-carrinho-mobile.png).
- [Catálogo completo no Docker Desktop](preview/docker-loja.png).
- [Confirmação do pedido no Docker Desktop](preview/docker-pedido.png).
- [Acesso administrativo no Docker Desktop](preview/login-admin.png).

Origem do logo, imagens, fontes e cores: [registro de assets](brand/assets.json) e [escopo da loja](loja-suzano.md).

## Entrega e limites

O código e a documentação foram enviados ao destino autorizado pelo usuário: [maiaJhfB/Desafio_dev_suzano](https://github.com/maiaJhfB/Desafio_dev_suzano). O commit inicial remoto foi preservado. A publicação do código não constitui hospedagem da aplicação.

JWT está implementado e testado, com um administrador por ambiente e sessão de 15 minutos. Não há cadastro público, refresh token ou revogação individual; logout limpa a memória do navegador. Não há pagamentos, frete ou envio de pedidos à Suzano. Preços e estoque são ilustrativos. Pendentes não reservam estoque. Chaves de idempotência bem-sucedidas permanecem persistidas, sem expiração automática. Não foram medidos carga, latência ou p95.

A validação anterior, em 21/10/2026, tinha 46 testes aprovados. Esta revisão amplia os cenários e corrige os pontos identificados na avaliação; a rastreabilidade está na [matriz de requisitos](criterios-avaliacao.md).
