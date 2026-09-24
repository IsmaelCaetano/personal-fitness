# AGENTS.md

Leia antes de alterar este repositório. A fonte de verdade do produto é `SPEC.md`.

## Stack

- Node.js `>=22.13.0`
- Next.js `16.3.4`, React `19.2.6`, TypeScript `5.9.3`
- Supabase JS `2.116.0`, Auth SSR `0.12.7`, Postgres com RLS
- Zod `3.25.76`
- pnpm `11.25.0`
- Produção: Vercel; fonte: GitHub branch `main`

## Comandos canônicos

| O quê | Comando |
|---|---|
| Verificação rápida | `pnpm check:fast` |
| Verificação completa | `pnpm check` |
| Testes | `pnpm test` |
| Tipos | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Desenvolvimento | `pnpm dev` |

Antes de relatar que funciona, rode `pnpm check`. Se não puder, diga exatamente qual etapa não foi executada.

## Mapa do projeto

- `app/page.tsx`: decide entre autenticação e aplicativo.
- `app/api/fitness/route.ts`: CRUD autenticado, concorrência otimista e limpeza de demo.
- `app/api/ai/`: geração de treino e OCR; nunca expor a chave.
- `features/fitness/app.tsx`: navegação e orquestração dos fluxos.
- `features/fitness/routines.tsx`: lista, edição, importação e entrada do gerador.
- `features/fitness/import-workout.tsx`: upload/transcrição/revisão de fichas.
- `features/fitness/profile-onboarding.tsx`: cadastro complementar obrigatório.
- `lib/fitness/model.ts`: contrato Zod persistido.
- `lib/fitness/sync.ts`, `sync-client.ts`, `sync-cache.ts`: reconciliação, fila/requests e diários locais por aba; o hook React adapta esses módulos.
- `lib/fitness/persistence.ts`: queries da API de fitness (bootstrap e CAS), isoladas para testes.
- `lib/fitness/domain.ts`: cálculos puros; teste aqui antes de usar na UI.
- `lib/fitness/import.ts`: parser determinístico de texto/JSON; identifica dia/turno, atividades na sessão, descanso e cargas por série. Mantenha os `base-*` existentes estáveis ao estender a biblioteca.
- `lib/fitness/seed.ts`: biblioteca estática e estado vazio de novas contas.
- `supabase/schema.sql`: tabela e RLS.
- `tests/`: testes de domínio e importação.

## Convenções

- Componentes interativos começam com `"use client"`; segredos e provedores externos ficam em rotas server-side.
- Valores de carga persistem em kg; conversão para lb acontece apenas na apresentação/entrada.
- Datas de calendário usam `YYYY-MM-DD`; timestamps usam ISO UTC.
- Toda entidade persistida tem `id` estável e validação Zod.
- Dados novos usam `newId()`; nunca derive IDs de e-mail ou informação pessoal.
- Erros de API para o usuário devem ser claros e genéricos; detalhe técnico vai para `console.error` no servidor.
- Chamadas externas precisam de timeout e limite de payload.
- IA/OCR nunca persistem por conta própria. Sempre existe preview/revisão e ação explícita.
- Preserve o tema visual escuro, verde-lima e a responsividade já estabelecida.
- Use `apply_patch` para editar arquivos; preserve mudanças não relacionadas.

## Variáveis

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave pública do Supabase.
- `GEMINI_API_KEY`: segredo server-only para geração e leitura de imagem.
- Nunca prefixe segredo com `NEXT_PUBLIC_`.
- `.env.local` não é versionado; `.env.example` contém apenas nomes vazios.

## Decisões já tomadas

- **O produto é multiusuário.** Nunca codifique preferências de Ismael ou de qualquer conta no gerador.
- **Contas novas ficam vazias.** Biblioteca estática não é histórico nem rotina mockada.
- **Perfil é por conta.** Altura, peso, objetivos e frequência alimentam a IA dinamicamente.
- **Gemini Flash-Lite é o provedor inicial.** Suporta texto/imagem e permite um único backend no MVP.
- **A resposta da IA é não confiável.** Validar JSON, limites e IDs antes de exibir ou salvar.
- **Imagem não é armazenada.** Ela é enviada em memória para transcrição e descartada após a requisição.
- **GitHub → Vercel é o fluxo de publicação escolhido pelo usuário.** Não migrar hospedagem silenciosamente.
- **Histórico real é preservado.** Excluir rotina não exclui sessões concluídas.

## Armadilhas deste ambiente

- **`initialData()` não possui sessões demo.** Testes antigos que acessam `seed.sessions[0]` estão obsoletos; crie fixture explícita.
- **Commits parciais podem quebrar deploy.** Arquivos de API, schema, UI e tipos de uma feature precisam chegar em um lote coerente.
- **`profileSchema.goals` exige ao menos um objetivo.** O estado inicial vazio só existe antes do onboarding; não validar esse seed como perfil concluído.
- **A biblioteca usa IDs `base-*`.** Não reordenar linhas existentes de `seed.ts`, pois isso muda vínculos salvos. Novos exercícios entram no fim.
- **Local cache pode conter schema anterior.** Migrações de modelo precisam tolerar/normalizar snapshots existentes.
- **Uma resposta de salvamento pode se perder após o commit no Supabase.** Antes de reenviar a fila local, compare cada alteração com o registro do servidor; conteúdo já salvo deve sair da fila, mas versões realmente diferentes exigem escolha do usuário. Nunca limpe toda a fila para resolver um conflito isolado.
- **Edição durante request não substitui a tentativa enviada.** Persistir `attempt` antes de enviar; confirmar o conteúdo e a próxima versão exata antes de avançar a edição posterior. GET após timeout pode chegar antes do commit: não descartar a intenção só porque corresponde ao estado antigo.
- **Uma chave local compartilhada entre abas perde filas.** Usar os diários de `sync-cache.ts` e Web Locks; nunca escrever diretamente na fila legada. Dados ilegíveis devem ser preservados, não substituídos por array vazio.
- **Excluir/recriar não pode reiniciar `version`.** Preservar marcador `deleted_at` com payload vazio; aplicar a migração versionada antes do deploy. Não remover marcadores em rollback nem ignorar `deletedIds` na reconciliação.
- **Bootstrap não pode atualizar perfil existente.** Criar com `ignoreDuplicates: true` e reler todos os recursos; não usar o retorno do insert como snapshot completo.
- **Resultado Gemini pode ser JSON válido e semanticamente ruim.** Sempre compilar contra a biblioteca e o `routineSchema`.
- **HEIC pode chegar com MIME vazio ou variável.** Validar extensão e normalizar antes da API.
- **A chave Gemini foi adicionada à Production na Vercel em 2026-09-23.** O primeiro teste revelou que `gemini-2.5-flash-lite` não está disponível para novas contas; o endpoint foi atualizado para `gemini-3.5-flash-lite` no commit `ba96ed4`. Ainda falta validar geração e OCR autenticados após o deploy.

## Nunca

- Nunca commitar senha, token, chave ou conteúdo de `.env.local`.
- Nunca enviar `GEMINI_API_KEY` ao cliente.
- Nunca usar dados de outra conta para gerar plano.
- Nunca aceitar resposta de IA sem Zod.
- Nunca salvar OCR/IA automaticamente.
- Nunca remover dados reais ao limpar registros demo.
- Nunca reordenar os exercícios `base-*` existentes.
- Nunca desabilitar gate para concluir entrega.
- Nunca relatar deploy pronto sem status final da Vercel.

## Ao mudar código

1. Leia a seção relevante de `SPEC.md`.
2. Ancore a mudança em um requisito ou atualize a spec antes.
3. Faça um lote pequeno e revisável.
4. Rode `pnpm check`.
5. Verifique entrada vazia, payload inválido, timeout, duplicata e concorrência.
6. Atualize este arquivo se descobrir uma nova armadilha.
7. Atualize `TASKS.md` e faça um commit coerente.
