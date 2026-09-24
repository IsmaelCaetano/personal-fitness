# Segurança do Personal Fitness

## Modelo de ameaça

Dados de perfil e treino, históricos, cargas, senhas de autenticação e conteúdo enviado à IA pertencem à conta autenticada. Ameaças principais: acesso cruzado por ID, edição de plano alheio, vazamento de chave, requisições entre origens, custos de IA por abuso, upload excessivo, resposta maliciosa do modelo e conflitos de sincronização que apagam dados.

## Controles atuais

- `/api/fitness` exige `getUser()`, valida payload por Zod, limita corpo, exige ID do perfil igual ao usuário e faz CAS por versão; a tabela `fitness_resources` usa RLS por `auth.uid()`.
- IA e OCR exigem sessão e validam origem. Gemini usa `GEMINI_API_KEY` apenas no servidor, timeout e validação estrutural de resposta. Fotos enviadas para transcrição não são persistidas no aplicativo; OCR valida MIME declarado, data URI e tamanho decodificado.
- Geração mensal usa quota relacional transacional e request ID, com RPC apenas para a chave privada do servidor. Importação e edição não consomem quota.
- Rate limit de OCR (12/h) e geração (6/h) usa função SQL transacional com identidade obtida por `auth.uid()`, além da quota mensal. O cliente não determina teto nem janela.
- Callback Auth só redireciona a caminhos locais; mensagens de falha da API evitam expor exceções internas. Credenciais de login são geridas por Supabase Auth.
- Substituições oferecidas pelo modelo são descartadas; resultados de IA passam por Zod, validação de domínio e revisão humana antes de persistir.

## Riscos e verificações pendentes

- **Banco real:** migrations 202609230001, 202609240001 e 202609240002 ainda não foram aplicadas ou testadas contra PostgreSQL/Supabase de homologação. Falhas de policy ou privilégio em produção impedem publicação segura.
- **Segredo externo:** `SUPABASE_SERVICE_ROLE_KEY` ainda precisa ser configurada somente no ambiente do servidor Vercel para a quota; nunca usar `NEXT_PUBLIC_`.
- **Autorização trainer:** relações, atribuições e policies ainda não existem. Não liberar edição de aluno por endpoint genérico de fitness; usar política separada por conteúdo atribuído.
- **Rate limit outros endpoints:** estender a convite e feedback quando implementados. O limite por hora requer aplicação da migration.
- **Teste real:** duas abas, dois aparelhos, OAuth/reset/callback, RLS autenticada e PDFs compartilhados exigem smoke test no ambiente publicado.
- **Dependências:** instalar apenas lockfile auditado; script transitivo de `core-js` foi explicitamente desabilitado.

## Checklist de revisão antes da publicação

1. Aplicar migrations versionadas em ordem; testar usuário A contra dados de B e quota simultânea.
2. Confirmar variáveis privadas na Vercel e que nenhum segredo está em Git, bundle ou log.
3. Exercitar signup, confirmação, recovery, login, logout, callback seguro e senha.
4. Testar entrada grande, MIME falso, origem externa, limites OCR/IA e falhas Gemini.
5. Rodar `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm check` e smoke test em homologação.
