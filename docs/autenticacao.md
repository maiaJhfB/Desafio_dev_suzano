# Autenticação e acesso administrativo

JWT é um diferencial do teste técnico e foi implementado por solicitação posterior do usuário. Há um administrador por ambiente; não é um cadastro de clientes. O catálogo e o checkout de pedidos pendentes permanecem públicos.

## Preparar e acessar

Após instalar as dependências, execute `pnpm auth:setup`. O comando cria `.env` se necessário, preserva a configuração existente e gera uma chave aleatória e uma senha aleatória quando faltarem. A senha fica em `tmp/admin-access.json`, ignorado pelo Git, junto ao email de acesso. Não envie esse arquivo nem `.env` ao repositório.

Use **Acesso administrativo** ou **Novo produto** no rodapé. Após entrar, o cadastro é liberado e **Sair** remove a sessão. No modo mock, o acesso é `admin@suzano.local` / `SuzanoDemo!2026`, indicado no modal. O mock usa tokens opacos de demonstração; não contém a chave de assinatura nem acessa a conta da API real.

`pnpm auth:setup --reset` troca senha e chave de assinatura. Reinicie a API ou recrie os containers para aplicar a configuração; os tokens anteriores deixam de ser aceitos. As credenciais locais são substituídas nesse comando.

## Contrato e autorização

- `POST /api/v1/auth/login`: recebe `email` e `password`; retorna `access_token`, `token_type: Bearer`, `expires_in: 900` e o usuário administrador. Credenciais incorretas retornam uma mensagem genérica com HTTP 401.
- `GET /api/v1/auth/me`: exige `Authorization: Bearer <access_token>` e retorna o administrador.
- GET de produtos e saúde da API são públicos. POST, PATCH, PUT e DELETE de produtos exigem JWT.
- GET de pedidos, GET por ID e PATCH de status exigem JWT. Criar pedido `Concluído` também exige JWT. Criar `Pendente` sem token é permitido; se um cabeçalho Authorization for enviado, ele precisa ser válido.
- O login permite cinco chamadas por IP por minuto, incluindo sucessos. HTTP 429 inclui `Retry-After`. O limite é local ao processo, com no máximo 1.024 IPs ativos; múltiplas réplicas exigiriam um limitador compartilhado e configuração explícita do proxy.

O Swagger em `/docs` documenta o esquema Bearer, os erros e a alternativa pública do checkout. Faça login e cole apenas o `access_token` em **Authorize**. O contrato exportado e os tipos gerados incluem os DTOs de autenticação.

## Decisões e limites

O módulo `auth` utiliza `@nestjs/jwt` com HS256, chave obrigatória de pelo menos 32 bytes, duração de 900 segundos, emissor `loja-suzano-api` e audiência `loja-suzano-admin`. A verificação restringe algoritmo, assinatura, emissor, audiência, subject, email, papel, emissão e expiração. Configuração ausente ou malformada impede a inicialização. A composição usa a [API oficial do módulo Nest JWT](https://github.com/nestjs/jwt).

A senha não é armazenada em texto puro na configuração da API: `AUTH_ADMIN_PASSWORD_HASH` tem o formato `scrypt$<salt32hex>$<digest128hex>`, com salt aleatório de 16 bytes e derivação de 64 bytes (N=16384, r=8, p=1). A comparação do digest usa tempo constante e emails inexistentes também executam a derivação. O script usa aspas simples para preservar os caracteres `$` do hash no Compose.

O navegador mantém o token somente em memória. Recarregar encerra a sessão local; expiração e respostas 401 exigem novo login. Se isso ocorrer durante o cadastro, os campos são preservados e o usuário precisa enviar novamente após entrar. Nenhuma mutação é repetida automaticamente. A expiração local é uma conveniência; a API sempre verifica o token.

Não há refresh token, cadastro público, permissões por cliente ou revogação individual. Uma cópia do token continua válida até expirar ou até a rotação da chave. Logout não invalida uma cópia no servidor. Para disponibilizar a aplicação fora do ambiente local, use HTTPS e gestão apropriada dos segredos; nenhum segredo pode estar em `NEXT_PUBLIC_*`. A autenticação não implementa cobrança, frete ou envio de pedidos à Suzano.

## Reprodução dos testes

As suítes de API exercitam assinatura, claims, expiração, configuração, headers, CORS, login e autorização por HTTP. A integração PostgreSQL verifica acesso administrativo e checkout público. Testing Library e Playwright cobrem login, logout, recarga, expiração e recuperação do formulário. O smoke Docker gera suas próprias credenciais aleatórias, verifica os bloqueios e entra/sai pela interface após uma compra pública.

`pnpm test:e2e:integrated` e `pnpm contracts:check` leem o acesso local de `tmp/admin-access.json`. Para contas próprias, o E2E aceita `AUTH_ADMIN_EMAIL` e `AUTH_TEST_ADMIN_PASSWORD`; a verificação de contratos aceita `CONTRACT_ADMIN_EMAIL` e `CONTRACT_ADMIN_PASSWORD`. A CI utiliza `pnpm auth:setup --test`, restrito ao GitHub Actions, com configuração descartável e valores mascarados. Os testes de API usam sua própria fixture isolada.

Os testes de navegador com credenciais reais desativam traces, vídeos e capturas automáticas de falha. O smoke captura o modal de login vazio e redige os valores privados nos logs; a configuração Compose anexada não resolve variáveis. Resultados, comandos e limites estão em [evidências](evidencias.md).
