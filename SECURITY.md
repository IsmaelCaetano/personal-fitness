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
- Relacionamentos de personal/aluno, prescrições, feedback e pagamentos usam tabelas relacionais com RLS; rotas conferem o vínculo ativo antes de consultar/alterar os dados. O aluno não recebe permissão de UPDATE em prescrições do personal. O identificador do aluno em requisições não concede acesso por si.
- Convites são enviados exclusivamente pelo servidor com a chave service role; aceitação verifica a identidade Auth e o e-mail do destinatário em RPC. O tipo da conta é criado pelo trigger Auth no primeiro INSERT; não há função ou ação de promoção para indivíduos, nem permissão de UPDATE em `account_type`.
- A ficha preenchida pelo personal fica no convite pendente com leitura limitada por RLS; a aceitação cria o perfil da conta verificada na mesma transação que ativa o vínculo. A função admite só campos de treino conhecidos e não altera o perfil já concluído de uma conta existente.
- Cadastro profissional é uma escolha feita **na criação** da identidade Auth. O trigger grava o papel, convidados com `invited_student` nascem individuais e alterações posteriores na metadata não promovem a conta. `register_trainer` e o INSERT de `account_profiles` para `authenticated` foram removidos; o UPDATE de `account_type` já é negado por privilégio de coluna. Há teste transacional de papel/convite com rollback em `supabase/tests/trainer_account_flow.sql`.
- A geração da IA para aluno valida o vínculo, lê apenas os registros daquele aluno e vincula a chave idempotente ao aluno/pedido. Feedback e pagamento não são modificáveis pela IA.

## Riscos e verificações pendentes

- **Banco real:** migrations `202609230001` a `202609240008` foram aplicadas no projeto de produção em 2026-09-24. A integridade dos 94 registros anteriores foi verificada na primeira aplicação; checagem posterior preservou 101 registros e 11 identidades Auth. Teste SQL transacional de papel/convite passou com rollback; ainda faltam testes autenticados de policies, triggers e concorrência entre contas. O SQL Editor não registra automaticamente histórico formal de migrations.
- **Segredo externo:** `SUPABASE_SERVICE_ROLE_KEY` foi observada como variável privada da Vercel em Production e Preview durante a publicação anterior; confirmar presença no ambiente de qualquer novo deploy, sem nunca expor o valor ou usar `NEXT_PUBLIC_`. `GEMINI_API_KEY` também deve ser verificada sem revelar o valor.
- **Convites para contas existentes:** se o provedor identificar conta já registrada, o convite permanece pendente e aparece dentro do app quando o aluno entrar. O personal deve avisá-lo para abrir a tela; envio de e-mail adicional exige provedor configurado. É preciso testar as respostas reais do Auth. Em convites novos, o nome fica na linha do convite, a senha só é definida após validação da sessão e `accept_trainer_invite` confere o e-mail autenticado. O fragmento com tokens é removido da URL assim que lido; o link de convite por e-mail tem prazo próprio do Supabase Auth e pode expirar antes do registro do convite.
- **Cache em aparelho compartilhado:** respostas de navegação autenticada contêm estado da conta serializado. O Service Worker v4 não armazena HTML de navegação e remove caches antigos; offline após recarga mostra apenas uma tela genérica, enquanto a aba já aberta conserva a fila local por usuário.
- **Autorização trainer:** RLS aplicada. Simulações em memória não substituem testes de personal A/aluno A contra personal B/aluno B, inclusive INSERT/UPDATE direto via cliente Supabase.
- **Rate limit:** OCR, gerador, convites e feedback precisam de teste de concorrência no banco. Não há camada LLM opcional do coach.
- **E-mail:** Supabase Auth envia confirmação/convite/recovery. O repositório não comprova se Resend SMTP ou `auth.caetanolabs.com` estão configurados no painel; verificar com duas contas controladas. Cadastro público permite a uma pessoa nova escolher papel personal; não há verificação profissional externa.
- **Teste real:** duas abas, dois aparelhos, OAuth/reset/callback, RLS autenticada e PDFs compartilhados exigem smoke test no ambiente publicado.
- **Dependências:** instalar apenas lockfile auditado; script transitivo de `core-js` foi explicitamente desabilitado.

## Checklist operacional para novo deploy

1. Conferir migrations já aplicadas antes de qualquer SQL novo; testar usuário A contra dados de B e quota simultânea.
2. Confirmar variáveis privadas na Vercel e que nenhum segredo está em Git, bundle ou log.
3. Exercitar signup, confirmação, recovery, login, logout, callback seguro e senha.
4. Testar entrada grande, MIME falso, origem externa, limites OCR/IA e falhas Gemini.
5. Rodar `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm check` e smoke test em homologação.
