# Decisões arquiteturais

Decisões aceitas no estado de 2026-09-24; consultar [SPEC.md](../SPEC.md) para comportamento de produto e [contexto](PROJECT_CONTEXT.md) para estado da implementação.

## D001 — Recursos individuais permanecem em JSONB

**Status:** Accepted. **Contexto:** modelo individual do MVP já versiona perfis, rotinas e sessões. **Decisão:** manter `fitness_resources` com payload Zod e CAS. **Motivo:** preservar dados antigos sem grande migração. **Consequências:** evolução requer compatibilidade com payloads antigos; analytics relacionais precisam de transformação. **Alternativa descartada:** reescrever todas as entidades em novas tabelas imediatamente.

## D002 — Vínculos, quota e pagamentos são relacionais

**Status:** Accepted. **Contexto:** autorização e transação de quota dependem de FKs/RLS. **Decisão:** tabelas `trainer_*`, `ai_*`, `notifications`, `student_feedback` e `payment_records`. **Consequências:** migrations incrementais, índices/policies específicos. **Alternativa descartada:** um documento JSONB gigante por treinador.

## D003 — Escrita otimista com diário por aba

**Status:** Accepted. **Contexto:** edições rápidas, internet intermitente e resposta perdida geravam falsos conflitos/perda de intenção. **Decisão:** version/CAS, tentativas imutáveis, reconciliação exata, tombstones e Web Locks por aba. **Consequências:** navegador moderno/HTTPS necessário e resolução humana no conflito real. **Alternativa descartada:** last-write-wins ou sobrescrever fila global.

## D004 — Quota de geração no Postgres

**Status:** Accepted. **Contexto:** requests simultâneos não podem ultrapassar duas gerações/mês UTC. **Decisão:** RPC transacional com reserva, confirmação, liberação e ID idempotente; service role só no servidor. **Consequências:** disponibilidade do gerador depende das migrations; importação/OCR seguem independentes. **Alternativa descartada:** contador na UI ou SELECT+UPDATE separado.

## D005 — Equivalência por movimento

**Status:** Accepted. **Contexto:** mesmo músculo não garante estímulo equivalente. **Decisão:** filtro determinístico por padrão/região/mecânica/equipamento/lateralidade, com possibilidade de nenhuma alternativa e restrições do treinador. **Consequências:** catálogo requer metadados adequados. **Alternativa descartada:** IA escolher livremente pelo músculo.

## D006 — Coach antes de LLM

**Status:** Accepted. **Contexto:** cada série precisa de feedback previsível sem custo/latência. **Decisão:** regras puras; explicador Gemini ainda não implementado. **Consequências:** feedback funciona sem IA. **Alternativa descartada:** chamada LLM obrigatória por série.

## D007 — Gemini só no servidor e resposta revisável

**Status:** Accepted. **Contexto:** proteger credencial e não gravar plano incorreto. **Decisão:** API autenticada, validação Zod/domínio, preview e confirmação explícita. **Consequências:** geração depende de chave privada, função manual continua disponível. **Alternativa descartada:** chamar Gemini no cliente ou persistir output diretamente.

## D008 — PDF local sem IA

**Status:** Accepted. **Contexto:** exportação reprodutível e sem transmitir dados extras. **Decisão:** dados → view model puro → jsPDF A4 no navegador. **Consequências:** testes de transformação e inspeção visual para PDFs extensos. **Alternativa descartada:** geração PDF por LLM.

## D009 — RLS como fronteira complementar

**Status:** Accepted. **Contexto:** contas diferentes e relação personal/aluno exigem isolamento. **Decisão:** Auth, autorização server-side e policies por `auth.uid()`/vínculo ativo. **Consequências:** testar policies com usuários reais; funções SECURITY DEFINER merecem revisão rigorosa. **Alternativa descartada:** confiar só na UI ou IDs enviados pelo cliente.

## D010 — Notificações inicialmente in-app

**Status:** Accepted. **Contexto:** feedback, alteração e pagamento precisam chegar ao usuário sem infraestrutura push. **Decisão:** tabela relacional, triggers/RPC e sino in-app. **Consequências:** usuário só vê mensagens ao abrir app; canal de e-mail futuro demanda decisão separada. **Alternativa descartada:** push/webhook externo no MVP.

## D011 — Tipo de conta imutável no cadastro Auth

**Status:** Accepted. **Contexto:** contas individuais não podem se promover pelo próprio perfil/request. **Decisão:** novo cadastro público escolhe individual/personal no início; trigger salva tipo uma vez, convite sempre individual, sem RPC de promoção. **Consequências:** usuário antigo individual precisa nova identidade para ser personal. **Alternativa descartada:** botão de troca de papel após login. **Limite:** ser personal no cadastro público não é verificação profissional externa.
