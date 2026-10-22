# Loja Suzano — produtos e pedidos

[![Validação](https://github.com/maiaJhfB/Desafio_dev_suzano/actions/workflows/ci.yml/badge.svg)](https://github.com/maiaJhfB/Desafio_dev_suzano/actions/workflows/ci.yml)

Loja de demonstração com identidade Suzano e navegação inspirada em marketplaces: busca, categorias, detalhes de produtos, carrinho persistido no navegador e checkout. A base atende ao teste técnico de frontend e backend, orientada pelo planejamento fornecido. Funciona com API simulada por MSW ou integrada ao NestJS e PostgreSQL.

O checkout registra pedidos **pendentes**, sem cobrança ou envio real. Valores, estoque e apresentações são ilustrativos. Os recursos oficiais da marca e o escopo da loja estão documentados em [Loja Suzano](docs/loja-suzano.md). A administração de produtos exige login no rodapé; conclusão e cancelamento de pedidos ficam no Swagger, também protegidos por JWT.

![Prévia desktop da loja demonstrativa](docs/preview/suzano-desktop.png)

## Pontos focais e avaliação

| Frente      | Entrega                                                                                                                     | Critérios atendidos                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Front-end   | Next.js, TypeScript, Tailwind, Context/reducer, TanStack Query, cadastro, busca, faixa de preço, ordenação, paginação e MSW | Funcionalidades, organização, reutilização e testes de comportamento |
| Back-end    | NestJS, camadas de controller/service/repository, PostgreSQL, CRUD, pedidos, JWT, validação e middleware de log             | SOLID, regras de negócio, persistência e testes de estoque           |
| Arquitetura | Monorepositório, contrato HTTP, migrations, transações, Swagger, Docker e CI                                                | Estrutura, consistência, reprodução do ambiente e documentação       |

Detalhes e rastreabilidade: [arquitetura](docs/arquitetura.md), [decisões](docs/adrs.md) e [matriz de avaliação](docs/criterios-avaliacao.md).

## Pré-requisitos

- Node.js **24.19.0** (registrado em `.node-version`).
- pnpm **11.25.0**: `npm install -g pnpm@11.25.0`.
- Docker Compose para o ambiente em containers, ou PostgreSQL local. A alternativa `pnpm db:local` inicia um PostgreSQL real sem instalar serviço no sistema.

```sh
git clone https://github.com/maiaJhfB/Desafio_dev_suzano.git
cd Desafio_dev_suzano
pnpm install --frozen-lockfile
```

Prepare a configuração antes de iniciar a API ou qualquer comando do Compose:

```sh
pnpm auth:setup
```

O comando cria `.env` a partir de `.env.example`, gera uma chave JWT e uma senha aleatória para o administrador. Preserva configurações existentes. O acesso local fica em `tmp/admin-access.json`; esse arquivo e `.env` são ignorados pelo Git. Os dados de banco do exemplo servem apenas ao desenvolvimento. Veja [autenticação e acesso](docs/autenticacao.md).

## Front-end independente

```sh
pnpm dev:mock
```

Abra [o catálogo](http://localhost:3000/produtos). Não precisa iniciar API ou banco. O indicador de demonstração explica que os cadastros simulados são mantidos em memória e voltam ao seed ao recarregar. O service worker MSW está versionado em `apps/web/public/mockServiceWorker.js`. Para cadastrar no modo mock, use **admin@suzano.local / SuzanoDemo!2026**. Esse acesso é exclusivo da simulação; a API real usa a senha aleatória local.

## Aplicação integrada

Inicie o banco por **uma** das opções:

```sh
pnpm db:up
```

Ou mantenha outro terminal aberto com o banco local:

```sh
pnpm db:local
```

Depois, em outro terminal:

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- [Catálogo](http://localhost:3000/produtos)
- [Swagger](http://localhost:3001/docs)
- [OpenAPI JSON](http://localhost:3001/docs-json)
- [Prontidão do banco](http://localhost:3001/api/v1/health/ready)

O comando `pnpm dev` seleciona o modo real explicitamente. Após trocar de modo, reinicie o frontend. Variáveis `NEXT_PUBLIC_*` são públicas e incorporadas no build; em containers, mudar o modo ou a URL exige reconstrução.

O seed usa IDs fixos e não sobrescreve produtos existentes, vendas, edições ou exclusões. O banco local mantém dados em `.local-postgres/`; Ctrl+C encerra seu processo. Use um banco separado para testes.

## Docker Compose

```sh
docker compose up --build -d --wait
docker compose run --rm migrate node dist/database/seed.js
```

O Compose inicia banco com healthcheck, executa migrations em um job único, inicia a API e depois o frontend. Banco publicado apenas em `127.0.0.1`; dados ficam em volume persistente. A URL da API no navegador é `localhost:3001`, e a conexão interna da API usa `db:5432`.

Os comandos retornam ao terminal após a inicialização. Acompanhe com `docker compose logs -f api web`; encerre com `docker compose down` (preserva os dados). Libere as portas 3000, 3001 e 5432 antes de subir esse ambiente. As imagens de execução usam usuário sem privilégios e não incluem as ferramentas de desenvolvimento.

Para validar o ambiente completo no Docker Desktop, instale o Chromium com `pnpm --filter @catalogo/web exec playwright install chromium` e execute `node scripts/docker-smoke.mjs --local`. Esse teste usa um projeto temporário, banco próprio e portas 13000, 13001 e 15432; ao terminar, remove somente os containers e volumes criados por ele. Logs e capturas ficam em `tmp/docker-smoke/`.

Ao usar outra origem para o frontend, configure `STORE_PUBLIC_ORIGIN` antes de executar o seed para que as imagens dos produtos de demonstração apontem para o endereço correto. O padrão é `http://localhost:3000`; o smoke configura sua origem automaticamente. O seed preserva registros existentes.

## Acesso administrativo

No rodapé, clique em **Novo produto** ou **Acesso administrativo** e informe os dados de `tmp/admin-access.json`. A sessão dura 15 minutos, fica somente na memória da página e termina ao recarregar ou clicar em **Sair**. Se expirar durante o cadastro, o formulário preserva os valores para novo login e envio manual.

No Swagger, execute `POST /api/v1/auth/login` com `email` e `password`. Copie o `access_token` para **Authorize**; o Swagger acrescenta o prefixo Bearer. `GET /api/v1/auth/me` confirma o administrador autenticado.

| Operação                                | Acesso                          |
| --------------------------------------- | ------------------------------- |
| Consultar produtos e saúde da API       | Público                         |
| Criar pedido `Pendente` no checkout     | Público, sem reserva de estoque |
| Criar, editar e excluir produtos        | Administrador com JWT           |
| Listar/consultar pedidos e mudar status | Administrador com JWT           |
| Criar pedido já `Concluído`             | Administrador com JWT           |

Um cabeçalho `Authorization` enviado na criação de qualquer pedido é validado, mesmo para pendentes. Sem token válido, operações protegidas retornam `401`. O login limita a cinco tentativas por IP por minuto, incluindo sucessos; `429` informa o tempo de espera.

Para trocar senha e chave, execute `pnpm auth:setup --reset` e reinicie a API ou recrie os containers. Isso invalida os tokens anteriores. Nunca coloque a chave, a senha ou o hash em variáveis `NEXT_PUBLIC_*`.

## API e regras

Prefixo `/api/v1`; atributos em português. `preco_centavos` representa o preço e `total_pedido_centavos` representa o total do pedido do enunciado, ambos em BRL com inteiros. Valores desconhecidos e campos adicionais são rejeitados.

```json
{
  "nome": "Teclado mecânico",
  "categoria": "Periféricos",
  "descricao": "Teclado compacto com conexão USB.",
  "preco_centavos": 19990,
  "quantidade_estoque": 10,
  "imagem_url": "https://example.com/teclado.jpg"
}
```

Envie esse JSON em `POST /produtos` com `Authorization: Bearer <access_token>`. Também existem `GET /produtos`, `GET /produtos/{id}`, `PATCH /produtos/{id}` e `DELETE /produtos/{id}`. PATCH exige ao menos um campo; estoque é uma atribuição absoluta. Exclusão é lógica e produtos excluídos deixam de aparecer nas consultas.

Exemplo de consulta: `/produtos?nome=teclado&preco_min_centavos=10000&preco_max_centavos=30000&ordenar=preco&direcao=asc&pagina=1&limite=12`. Filtros são combináveis, limites inclusivos, busca sem distinção de maiúsculas e `%`/`_` literais. `ordenar` aceita `nome`, `preco` e `criado_em`; toda ordenação desempata por UUID. Resposta: `{ "data": [], "meta": { "pagina": 1, "limite": 12, "total": 0, "total_paginas": 0 } }`.

Crie um pedido com um ID obtido na listagem:

```json
{
  "produtos": [{ "produto_id": "10000000-0000-4000-8000-000000000001", "quantidade": 2 }],
  "status": "Pendente"
}
```

`POST /pedidos` aceita `Pendente` (padrão) ou `Concluído`. `GET /pedidos` lista com paginação e filtro opcional `status`; `GET /pedidos/{id}` consulta os detalhes. `PATCH /pedidos/{id}/status` recebe `{ "status": "Concluído" }` ou `{ "status": "Cancelado" }`.

- Pedido pendente verifica disponibilidade, sem reservar nem baixar estoque. A conclusão verifica novamente.
- Preços, nomes e subtotais são capturados no momento da criação. Alterar o catálogo preserva o histórico.
- A conclusão baixa todos os itens em uma única transação com bloqueios de linhas em ordem de UUID. Qualquer falha desfaz a operação inteira.
- Repetir a conclusão do mesmo pedido não baixa o estoque novamente. Estados finais não reabrem; cancelar pendente não altera estoque.
- Produto excluído depois da criação impede a conclusão do pedido pendente.
- `POST /pedidos` aceita o cabeçalho opcional `Idempotency-Key` com um UUID. Repetir a mesma chave e os mesmos itens/status devolve a resposta original (`201` e `Idempotency-Replayed: true`), sem duplicar o pedido; reutilizar a chave com outro conteúdo retorna `409`. Falhas não consomem a chave. O carrinho mantém a chave nas tentativas da mesma compra após falha de rede, inclusive ao recarregar a mesma aba. Sem o cabeçalho, cada POST é uma operação distinta.

Categoria obrigatória e estoque opcional no formulário complementam a diferença de campos entre os desafios. A URL da imagem é obrigatória no formulário e opcional na API; somente HTTP(S), sem credenciais embutidas. O navegador carrega imagens externas diretamente, com fallback local.

## Verificações

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Para integração, mantenha PostgreSQL ativo e crie um banco **descartável cujo nome termine em `_test`**. `pnpm db:local` já cria `catalogo_test`. A suíte executa migrations e limpa as tabelas somente desse banco protegido pelo nome. Sem `TEST_DATABASE_URL`, ela falha com uma orientação, em vez de passar sem executar os testes. Não execute duas instâncias dessa suíte no mesmo banco.

Se estiver usando o banco do Compose, crie o banco de testes uma vez com `docker compose exec db createdb -U catalogo catalogo_test`. Em uma instalação PostgreSQL própria, use um usuário com permissão de criar e alterar tabelas nesse banco descartável.

PowerShell:

```powershell
$env:TEST_DATABASE_URL='postgresql://catalogo:catalogo@127.0.0.1:5432/catalogo_test'
pnpm test:integration
```

Linux/macOS:

```sh
TEST_DATABASE_URL=postgresql://catalogo:catalogo@localhost:5432/catalogo_test pnpm test:integration
```

Antes dos testes no navegador, encerre o servidor de desenvolvimento que ocupe a porta **3000**. O Playwright inicia e encerra seu próprio frontend. Instale o Chromium uma vez e rode os cenários funcionais:

```sh
pnpm --filter @catalogo/web exec playwright install chromium
pnpm test:e2e --grep-invert @visual
```

Para o navegador integrado, mantenha PostgreSQL ativo, configure `DATABASE_URL` para o banco de desenvolvimento e execute na ordem:

```sh
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm test:e2e:integrated
```

A API compilada é iniciada pelo Playwright na porta 3001; uma API já iniciada pode ser reutilizada localmente, desde que tenha as mesmas migrations e configuração. O teste lê o acesso local de `tmp/admin-access.json`. Para uma conta configurada manualmente, forneça `AUTH_ADMIN_EMAIL` e `AUTH_TEST_ADMIN_PASSWORD` ao processo de teste. A CI gera sua própria configuração descartável. Esses cenários criam registros de demonstração nesse banco; não aponte para dados de produção. O banco `_test` é exclusivo da suíte de integração da API.

No **Windows**, rode `pnpm test:visual` para comparar com a baseline versionada. Em Linux/macOS, use os testes funcionais e a execução visual Windows da CI; não gere outra baseline para encobrir diferenças. Para executar todos os cenários mock, incluindo o visual, no Windows: `pnpm test:e2e`.

Os testes de domínio verificam totais e transições. A integração usa PostgreSQL real para verificar CRUD, validação, disputa de estoque, idempotência e rollback. Os testes de frontend usam Testing Library/MSW; Playwright cobre os fluxos no navegador. A CI separa o teste visual em Windows dos testes funcionais em Linux e valida o ambiente Docker em um projeto descartável.

Com a API iniciada, regenere o contrato:

```sh
pnpm contracts:generate
pnpm contracts:check
```

`contracts:check` utiliza o acesso local de `tmp/admin-access.json`, ou as variáveis `CONTRACT_ADMIN_EMAIL` e `CONTRACT_ADMIN_PASSWORD` para um ambiente próprio. A especificação fica em `docs/openapi.json`, com tipos de transporte gerados em `packages/contracts`. Nenhuma entidade de banco é compartilhada com o navegador.

## Escopo e limites

JWT foi acrescentado como diferencial e por solicitação posterior do usuário. Há um administrador configurado por ambiente, sem cadastro público, refresh token ou lista de revogação. Sair remove a sessão do navegador; uma cópia do token continua válida até expirar ou até a troca da chave. Pagamentos, frete e tela administrativa de pedidos continuam fora do escopo. Catálogo e checkout de pendentes são públicos. Não foram feitas medições de metas p95 ou de carga. O Compose e o pipeline estão incluídos para reprodução; seu estado de validação consta em [evidências](docs/evidencias.md).

Código e documentação: [maiaJhfB/Desafio_dev_suzano](https://github.com/maiaJhfB/Desafio_dev_suzano). A publicação foi solicitada explicitamente pelo usuário. O envio ao GitHub não publica a loja em um domínio nem realiza operações comerciais.
