# Matriz de requisitos e avaliação

Fontes: teste técnico fornecido pelo usuário, páginas 1-2 (frontend), 3-4 (backend) e 5 (entrega/avaliação); planejamento técnico, seções 2, 3, 7, 12 e 17. O teste define obrigações; o planejamento fundamenta decisões adicionais. O usuário autorizou posteriormente a publicação em [maiaJhfB/Desafio_dev_suzano](https://github.com/maiaJhfB/Desafio_dev_suzano).

Legenda: **O** obrigatório do teste, **D** diferencial do teste, **P** decisão ou extensão do planejamento. A existência de um arquivo de teste não significa que ele foi executado com sucesso. Resultados observados e limitações do ambiente devem constar no registro de verificação da entrega.

## Como avaliar

| Critério do enunciado         | Evidência procurada                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. Organização do código      | Módulos por domínio, separação controller/service/repository, componentes por funcionalidade, contrato explícito     |
| 2. Cumprimento dos requisitos | Fluxos reproduzíveis da matriz abaixo e API documentada                                                              |
| 3. Qualidade do código        | Regras em serviços, dependências injetáveis, validação de fronteiras, uma fonte por estado, cálculo monetário seguro |
| 4. Testes                     | Comportamento observado, casos de erro e riscos de estoque; mocks não substituem verificação PostgreSQL              |
| 5. Extras                     | Paginação, responsividade, documentação, snapshot, Swagger e Docker quando comprovados                               |

A beleza da interface é critério de desempate no PDF. Ela não substitui funcionamento, legibilidade, testes ou organização.

## Frontend

| ID / tipo          | Requisito                                                    | Evidência de implementação                   | Aceite e teste                                                             |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------- |
| FE-01 O            | Listar nome, categoria, preço, descrição e imagem            | `apps/web/src`: catálogo e cards             | Verificar os cinco atributos em um produto da fixture; preço em BRL        |
| FE-02 O            | Cadastrar nome, preço, descrição e URL; mostrar novo produto | Formulário, validação e mutação HTTP         | Cadastrar, observar confirmação e novo item; erro mantém valores           |
| FE-03 O            | Filtros por nome e faixa de preço                            | Query da URL e cliente de produtos           | Combinar nome e limites inclusivos; faixa inválida tem feedback            |
| FE-04 O            | Ordenação dos resultados                                     | Controle e parâmetros de consulta            | Ordenar por nome/preço nas duas direções antes de paginar                  |
| FE-05 O            | Next.js, TypeScript e Tailwind                               | `apps/web/package.json` e fontes             | Compilação e checagem de tipos; estilos renderizados                       |
| FE-06 O            | Estado global                                                | Provider Context e reducer da UI             | Ação de cadastro e dialog compartilham estado sem duplicar produtos        |
| FE-07 O            | API fictícia por HTTP                                        | Handlers MSW e bootstrap condicional         | Iniciar modo mock sem API/banco; GET/POST funcionam via HTTP               |
| FE-08 O (objetivo) | Testes de frontend                                           | Suíte de componentes e/ou E2E                | Exercitar listagem, cadastro, filtros e erros; registrar comando/resultado |
| FE-09 D            | Paginação                                                    | Metadados e controles de página              | Mudar página, respeitar filtros e não perder consulta                      |
| FE-10 D            | Responsividade                                               | Tailwind e composição do catálogo            | Inspecionar 360 px e desktop sem rolagem horizontal                        |
| FE-11 D            | Documentação das escolhas                                    | README e `docs/arquitetura.md`               | Avaliador identifica estado, mock/real, stack e limites                    |
| FE-12 D            | Um snapshot de tela                                          | Teste visual e baseline versionada           | Executar no ambiente da baseline; baseline revisada visualmente            |
| FE-13 P            | Modo real integrado                                          | Cliente HTTP com URL configurável            | Criar produto, recarregar e confirmar persistência pela API                |
| FE-14 P            | Acessibilidade e estados de UI                               | Labels, mensagens, foco, estados de consulta | Fluxo por teclado, erro anunciado e imagem inválida com fallback           |

## Extensão de loja solicitada depois do teste

Essas funcionalidades foram solicitadas posteriormente pelo usuário. Elas não são apresentadas como obrigatórias no PDF original.

| ID    | Funcionalidade                           | Evidência e aceite                                                                                                   |
| ----- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| LJ-01 | Identidade Suzano e apresentação de loja | Assets com origem oficial, busca/categorias e cards de compra; fontes em [loja-suzano.md](loja-suzano.md)            |
| LJ-02 | Carrinho e quantidades                   | Adicionar produto e alterar quantidade; estado permanece após recarregar                                             |
| LJ-03 | Checkout demonstrativo                   | Enviar produtos/quantidades para pedido Pendente, mostrar confirmação/ID e limpar somente após sucesso; sem cobrança |
| LJ-04 | Loja responsiva                          | `apps/web/tests/e2e/store.spec.ts` verifica viewport de 360 px e dialog sem overflow                                 |

Os resultados executados da extensão são registrados separadamente em [evidencias.md](evidencias.md).

## Backend

| ID / tipo | Requisito                                                       | Evidência de implementação                       | Aceite e teste                                                                                                                               |
| --------- | --------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-01 O   | Criar/listar/editar/excluir produtos                            | Módulo de produtos em `apps/api/src`             | CRUD por HTTP; excluído retorna 404 e some da lista                                                                                          |
| BE-02 O   | ID automático, nome, categoria, descrição, preço e estoque      | DTOs, entidade e migration                       | Campos persistem; ID gerado; preço/estoque inválidos são rejeitados                                                                          |
| BE-03 O   | Criar/listar pedidos com produtos e quantidades, total e status | Módulo de pedidos                                | Lista traz itens; total usa preço do servidor e quantidade                                                                                   |
| BE-04 O   | Conferir estoque ao criar pedido                                | Service e operação transacional                  | Saldo insuficiente rejeita sem gravar pedido parcial                                                                                         |
| BE-05 O   | Baixar estoque quando concluído                                 | Criação concluída e transição de status          | Pendente mantém saldo; concluído baixa; repetição não duplica baixa                                                                          |
| BE-06 O   | Node.js com NestJS e classes                                    | Módulos, controllers e services                  | Aplicação inicia com injeção de dependência e rotas documentadas                                                                             |
| BE-07 O   | Camadas controller/service/repository e SOLID                   | Portas e adapters de persistência                | Controller delega; serviço concentra regras e é testável por dependências injetadas; modelos e erros de domínio independem de TypeORM e HTTP |
| BE-08 O   | Banco de dados                                                  | PostgreSQL, TypeORM e migrations                 | Migrar banco vazio, seed e verificar persistência real                                                                                       |
| BE-09 O   | Ao menos um middleware                                          | Middleware de request ID e logging               | Requisição gera registro e cabeçalho correlacionável                                                                                         |
| BE-10 O   | Ao menos dois testes unitários                                  | Suíte de serviços                                | Executar teste de cálculo e falta de estoque; ampliar para transições                                                                        |
| BE-11 D   | Swagger ou Postman                                              | `/docs` e especificação OpenAPI                  | Parâmetros, corpos, status e erros navegáveis                                                                                                |
| BE-12 D   | JWT simples                                                     | Extra opcional                                   | Só considerar entregue com login, proteção consistente e testes                                                                              |
| BE-13 D   | Docker para subir ambiente                                      | Dockerfiles e Compose da raiz                    | Subida limpa, migrations e healthchecks; registrar se indisponível                                                                           |
| BE-14 P   | Soft delete e snapshots                                         | Produtos removidos logicamente; itens históricos | Mudança de preço não reprecifica; exclusão não destrói histórico                                                                             |
| BE-15 P   | Concorrência e rollback                                         | Locks e unidade de trabalho                      | PostgreSQL real: duas compras disputam o mesmo saldo; somente uma conclui e nenhuma baixa parcial permanece                                  |
| BE-16 P   | Conclusão e cancelamento explícitos                             | `PATCH /pedidos/:id/status`                      | Finais não reabrem; cancelar pendente não baixa; repetir status é seguro                                                                     |

## Entrega e verificação

| ID / tipo | Requisito                                   | Evidência / verificação                                                                                                    |
| --------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| EN-01 O   | Código em repositório Git e link de entrega | [Repositório da entrega](https://github.com/maiaJhfB/Desafio_dev_suzano), com código, documentação e workflow de validação |
| EN-02 O   | Prazo de cinco dias úteis                   | Restrição do teste; sem data de início confirmada não se inventa vencimento absoluto                                       |
| EN-03 D   | Instruções para executar aplicação e testes | README, exemplos de ambiente, lockfile, comandos e limitações                                                              |
| EN-04 P   | Reproduzir instalação e build               | Executar checks disponíveis e registrar os que exigem recurso ausente                                                      |

## Roteiro de demonstração

1. Iniciar modo mock sem API, mostrar os cinco campos, buscar por nome, combinar faixa e ordenar.
2. Cadastrar produto, confirmar mensagem e visibilidade; navegar na paginação e em tela pequena.
3. Iniciar modo real, criar produto e recarregar para conferir persistência.
4. Pelo Swagger, criar pedido pendente e confirmar saldo inalterado; concluir e verificar baixa.
5. Repetir a conclusão e conferir que o saldo não muda; demonstrar rejeição por saldo insuficiente.
6. Mostrar testes, organização em camadas, migrations, decisões e limitações observadas.

O roteiro é uma orientação de aceite, não uma declaração de execução. Evidências reais devem incluir os comandos, os resultados e o ambiente usado, especialmente para concorrência PostgreSQL e screenshot visual.
