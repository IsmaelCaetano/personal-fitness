# Personal Fitness

Aplicação pessoal para planejar e registrar musculação, corrida e outras atividades. Permite importar rotinas em linguagem natural ou JSON, trocar exercícios, acompanhar carga e volume, consultar o histórico e usar demonstrações visuais offline.

## Tecnologias

- Next.js 16 e React 19
- Supabase Auth e Postgres com Row Level Security
- Vercel
- TypeScript, Tailwind CSS e Zod

## Configuração local

1. Crie um projeto no Supabase.
2. Execute [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor.
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública do projeto.
4. Instale e execute:

```bash
pnpm install
pnpm dev
```

Variáveis necessárias:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Verificação

```bash
pnpm build
pnpm lint
```

O banco usa uma tabela JSONB versionada por usuário. As políticas RLS garantem que cada pessoa só consiga ler e alterar os próprios registros.
