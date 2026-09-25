# Tarefas

Estado em 2026-09-24. [SPEC.md](SPEC.md) define comportamento; [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) registra implementação. Código, migration aplicada e teste autenticado são marcos **diferentes**. Não repetir SQL apenas porque o painel não mostra histórico da migration.

## Agora

- [ ] **T-A1 — Testar convite real entre duas contas controladas** · R21–R23 · novo personal → pré-cadastro/ficha → e-mail → senha do aluno → vínculo → painel; incluir link expirado, conta já existente e responsividade mobile. O teste SQL com rollback já passou, mas não testa entrega de e-mail.
- [ ] **T-A2 — Testar isolamento RLS com pessoas distintas** · R1, R21–R22 · personal A lê somente aluno A; personal B/aluno B negados; aluno não altera prescrição; usar cliente Auth, não service role.
- [ ] **T-A3 — Testar persistência real e reconexão** · R13–R19 · duas abas/dispositivos, resposta perdida, conflitos reais, internet offline/online e tombstone após exclusão; não limpar armazenamento para “consertar”.
- [ ] **T-A4 — Validar gerador/OCR e quota reais** · R7–R10, R20 · chave privada, 0/2→2/2, mês UTC, Gemini falha sem consumo, retry, foto e erro 429; conferir RPC/RLS.
- [ ] **T-A5 — Revisar rotas Auth e e-mail** · R1, R21–R23 · confirmação, recuperação, troca de senha com reautenticação, redirect seguro; verificar SMTP/domínio `auth.caetanolabs.com` no Supabase e entrega, sem expor credenciais.

## Próximo

- [ ] **T-P1 — Verificar PDF e substituições no navegador** · R5, R11, R24 · documentos longos/acentos, troca equivalente, equipamento indisponível, recusa e override personal.
- [ ] **T-P2 — Verificar atribuição, feedback, notificações e pagamento** · R1, R21–R23 · aluno executa prescrição, recebe resposta do personal, lê aviso; dois alunos não misturam pagamentos; conferir deduplicação de lembrete.
- [ ] **T-P3 — Revisar interface e mídia offline** · R23–R25 · Perfil e portal desktop/mobile, GIF/imagem aberta previamente, fallback após recarga offline e treino em aba já aberta.
- [ ] **T-P4 — Formalizar controle do banco de produção** · R1, R21 · reconciliar histórico SQL Editor com `supabase/migrations/` antes de novas alterações; realizar teste transacional das policies com contas reais.

## Backlog

- [ ] **T-B1 — Coach explicativo opcional** · especificar limite persistente e fallback antes de criar endpoint Gemini; feedback determinístico já funciona.
- [ ] **T-B2 — Política de privacidade publicada** · explicar envio a Gemini e retenção de dados; aviso atual no Perfil não substitui texto jurídico.
- [ ] **T-B3 — Mais mídia demonstrativa licenciada** · confirmar direito de uso/atribuição antes de incluir fonte externa; registro manual sempre disponível.
- [ ] **T-B4 — Verificação de profissionais** · cadastro público inicial aceita autodeclaração personal; exigiria nova decisão de produto para aprovação externa.

## Feito

- [x] **Dados reais e importação** · contas vazias, onboarding individual, importação texto/JSON/foto, semana com sessões no mesmo dia e cargas por série (`33ddc4a`, `e5af33b`).
- [x] **Lote 1 — concorrência no código** · fila por aba e CAS com regressões (`859b424`, `858e2f6`, `41163fb`); migration `202609230001` aplicada.
- [x] **Lote 2 — quota no código** · duas gerações/mês UTC, reserva/ID atômicos (`f5ba8a9`); migration `202609240001` aplicada.
- [x] **Lote 3 — equivalência** · filtro biomecânico e override (`0176797`).
- [x] **Lote 4 — PDF A4** · jsPDF e view model testável (`97f6101`).
- [x] **Lote 5 — coach determinístico** · dicas sem Gemini (`4eefa17`).
- [x] **Lote 6 — segurança local** · rotas/callback/rate limit (`3661936`); migration `202609240002` aplicada.
- [x] **Lote 7 — fundação personal/aluno** · vínculos, convite, trigger de papel, pré-cadastro/ficha e aceitação atômica (`88b617f`, `bef7d4a`, `7f549f8`, `72e3bbf`, `0376993`); migrations `202609240003`, `006`, `007`, `008` aplicadas. Teste SQL transacional `supabase/tests/trainer_account_flow.sql` passou com rollback.
- [x] **Lote 8 — dashboard/prescrição** · portal, atribuição e execução na conta do aluno (`decf67e`).
- [x] **Lote 9 — feedback/notificação** · triggers e sino in-app (`5165368`); migration `202609240004` aplicada.
- [x] **Lote 10 — aderência/mensalidades** · UTC e lembretes deduplicados (`709dd8b`); migration `202609240005` aplicada.
- [x] **Lote 11 — perfil/senha** · preferências retrocompatíveis e Auth (`6d9fcc6`).
- [x] **Lote 12 — revisão local e publicação** · Service Worker sem HTML privado, mídia pública parcial e papel imutável (`dfc4efc`, `e088ce4`, `0376993`); código em `main` no merge `8a995de`, deploy Vercel Ready antes deste pacote documental. Gate anterior passou 98 testes; testes autenticados estão em **Agora**.
