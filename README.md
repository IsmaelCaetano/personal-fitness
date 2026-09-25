# Personal Fitness

Plataforma de treinos individuais e acompanhamento por personal trainer, com histórico de execução e planejamento assistido por IA.

## O que é

Organiza musculação, corrida e treinos híbridos; permite criar ou importar fichas, executar sessões, registrar cargas e acompanhar histórico e progresso. Personal trainers podem pré-cadastrar alunos, prescrever rotinas, receber feedback, acompanhar aderência e controlar pagamentos administrativamente. Há geração de planos revisáveis por IA, transcrição de fichas por imagem, substituições equivalentes e exportação de treinos em PDF. Pagamentos não são processados no aplicativo.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS, Zod, Supabase Auth/Postgres com RLS, Vercel, Gemini server-side, jsPDF e pnpm.

## Arquitetura resumida

Navegador → Next.js → rotas API → Supabase/Postgres. A IA é chamada apenas pelas rotas no servidor: navegador → API → Gemini. A fila local reconcilia gravações por versão; prescrições e vínculos de aluno ficam em tabelas relacionais. Consulte [arquitetura](docs/ARCHITECTURE.md).

## Começar localmente

Pré-requisitos: Node.js >=22.13, pnpm 11.25 e projeto Supabase configurado. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` e, para links de convite locais, `APP_ORIGIN`. Nunca versionar valores secretos.

```bash
pnpm install
pnpm dev
```

Para banco novo, consulte [o guia de banco](docs/DATABASE.md) antes de executar `supabase/schema.sql`; para banco existente, aplique somente migrações pendentes em ordem. O ambiente de produção recebeu as migrações até `202609240008`; confira a situação antes de reaplicar.

## Comandos

| Comando | Finalidade |
|---|---|
| `pnpm dev` | Servidor local |
| `pnpm test` | Testes automatizados |
| `pnpm typecheck` | Tipagem |
| `pnpm lint` | ESLint |
| `pnpm build` | Build de produção |
| `pnpm check` | Gate completo, inclusive build e segredos |

## Banco

`supabase/schema.sql` reproduz o estado final em banco novo; `supabase/migrations/` contém alterações incrementais para bancos existentes. [Banco e RLS](docs/DATABASE.md).

## IA

Gemini gera programas e transcreve fotos mediante validação e revisão humana; o coach e as substituições são determinísticos. A quota mensal de geração é aplicada no servidor. [Detalhes da IA](docs/AI.md).

## Segurança

Identidade via Supabase Auth, autorização no servidor e RLS, entradas validadas e segredos privados. [Modelo de ameaças e pendências](SECURITY.md).

## Documentação

| Arquivo | Para que serve |
|---|---|
| [AGENTS.md](AGENTS.md) | Regras operacionais e gates para colaboradores |
| [SPEC.md](SPEC.md) | Contrato de produto e critérios verificáveis |
| [TASKS.md](TASKS.md) | Estado e próximas verificações |
| [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) | Entrada compacta para nova sessão |
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Estado técnico e invariantes do produto |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Fluxos e módulos reais |
| [docs/DATABASE.md](docs/DATABASE.md) | Modelo, migrações e acesso aos dados |
| [docs/AI.md](docs/AI.md) | Provedor, validação, quota e fallback |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Operação, deploy e diagnóstico |
| [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md) | Histórico de lotes e commits |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisões arquiteturais e consequências |
| [SECURITY.md](SECURITY.md) | Controles, ameaças e riscos remanescentes |
