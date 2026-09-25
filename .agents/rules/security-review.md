---
trigger: model_decision
description: "Ativa revisão especializada de segurança, Supabase, Auth, RLS, banco e APIs sensíveis do Personal Fitness."
---

# Personal Fitness — Security & Database Review

Use esta regra sempre que a tarefa envolver qualquer uma destas áreas:

- Supabase
- Auth
- RLS
- banco de dados
- migrations
- APIs
- Trainer/Aluno
- convites
- service role
- quotas
- pagamentos
- uploads
- informações pessoais
- IA usando dados do usuário
- alteração de senha
- recuperação de senha
- notificações com dados privados
- autorização entre contas

O objetivo é garantir que segurança seja validada no servidor e no banco, não apenas na interface.

---

# 1. PRINCÍPIO FUNDAMENTAL

Nunca confie em autorização feita apenas no frontend.

Toda operação sensível deve ser validada em pelo menos uma das seguintes camadas:

- servidor;
- Supabase RLS;
- constraint de banco;
- função/RPC segura.

Idealmente mais de uma quando fizer sentido.

---

# 2. AUTENTICAÇÃO

Verificar:

- usuário realmente autenticado;
- `supabase.auth.getUser()` usado onde apropriado;
- sessão expirada tratada;
- callback seguro;
- logout correto;
- reset password correto;
- troca de senha correta;
- convite seguro.

Nunca confiar apenas em:

- email recebido no body;
- user_id recebido no body;
- role recebido no frontend.

---

# 3. AUTORIZAÇÃO

Verificar sempre:

- usuário pode acessar este recurso?
- usuário é dono?
- trainer realmente possui vínculo ativo com o aluno?
- aluno acessa somente dados próprios?
- usuário comum consegue simular role trainer?
- ID arbitrário consegue conceder acesso?

Nunca permitir IDOR.

Exemplo:

rota:

`/api/student/[id]`

não pode assumir que o usuário pode acessar aquele aluno apenas porque conhece o ID.

Validar vínculo no servidor e/ou RLS.

---

# 4. TRAINER / STUDENT

Para qualquer feature Trainer/Aluno verificar:

Trainer A -> Student A vinculado:
PERMITIDO

Trainer A -> Student B não vinculado:
NEGADO

Trainer A -> Student de outro trainer:
NEGADO

Student A -> Student B:
NEGADO

Student -> própria execução:
PERMITIDO

Student -> editar estrutura protegida do trainer:
NEGADO

Student -> visualizar seus próprios treinos:
PERMITIDO

Trainer -> histórico do aluno ativo:
PERMITIDO conforme regras documentadas.

Trainer -> ex-aluno:
somente de acordo com política explícita.

Nunca assumir:

`role === "trainer"`

no frontend como proteção suficiente.

---

# 5. SUPABASE RLS

Toda tabela contendo dados de usuário deve ser revisada.

Verificar:

SELECT

INSERT

UPDATE

DELETE

Policies devem ser explícitas.

Não confiar apenas em:

`user_id = auth.uid()`

quando o domínio exigir relacionamento trainer/student.

Revisar também:

- `WITH CHECK`;
- `USING`;
- relacionamentos;
- tabelas auxiliares;
- policies indiretas.

Testar conceitualmente acesso cruzado.

---

# 6. SERVICE ROLE

`SUPABASE_SERVICE_ROLE_KEY`:

- SOMENTE servidor;
- nunca `NEXT_PUBLIC_*`;
- nunca client component;
- nunca enviado em response;
- nunca enviado para browser;
- nunca logado;
- nunca commitado.

Se necessário:

criar cliente admin separado.

Usar cliente admin somente para operações que realmente exigem privilégio elevado.

Exemplos:

- convite Auth Admin;
- administração controlada.

Toda rota usando service role deve realizar autorização manual rigorosa ANTES da operação privilegiada.

---

# 7. INPUT VALIDATION

Toda entrada externa deve ser considerada não confiável.

Validar com Zod quando apropriado:

- body;
- params;
- query;
- metadata;
- upload metadata;
- dados de IA;
- IDs.

Verificar:

- tamanho;
- formato;
- enum;
- limites;
- datas;
- valores negativos;
- strings gigantes;
- IDs vazios.

Nunca confiar em TypeScript como validação runtime.

---

# 8. IA

Output de IA é NÃO CONFIÁVEL.

Fluxo:

IA
↓
parse
↓
Zod
↓
domain validation
↓
preview
↓
human action
↓
persistence

IA nunca pode:

- alterar permissões;
- criar vínculo trainer/student;
- modificar senha;
- marcar pagamento;
- contornar quota;
- contornar RLS;
- persistir automaticamente.

Prompt injection deve ser considerado.

Dados do usuário enviados para IA devem ser minimizados.

Nunca enviar mais contexto que o necessário.

---

# 9. QUOTA / RATE LIMIT

Quota nunca deve depender somente do frontend.

Validar server-side.

Operações concorrentes devem ser seguras.

Evitar padrão inseguro:

SELECT count
IF count < limit
UPDATE

quando duas requisições podem passar ao mesmo tempo.

Preferir operação atômica no banco.

Rate limit quando aplicável:

- geração IA;
- OCR;
- coach IA;
- convites;
- feedback;
- endpoints sensíveis.

---

# 10. LOGGING

Nunca logar:

- senha;
- JWT;
- access token;
- refresh token;
- recovery token;
- confirmation token;
- ConfirmationURL;
- API key;
- SMTP password;
- service role key.

Logs técnicos devem evitar dados pessoais desnecessários.

Quando precisar de identificação para debug:

usar identificador mínimo necessário.

---

# 11. UPLOADS

Para uploads verificar:

- MIME;
- extensão;
- tamanho;
- tipo permitido;
- conteúdo inesperado;
- filename;
- tratamento de HEIC;
- descarte do arquivo;
- armazenamento quando aplicável.

Não confiar somente em extensão.

Não executar conteúdo enviado pelo usuário.

---

# 12. BANCO DE DADOS

Para novas tabelas verificar:

- primary key;
- foreign keys;
- unique constraints;
- indexes;
- timestamps;
- not null;
- checks;
- RLS;
- policies.

Evitar:

- cascade destrutivo sem necessidade;
- FK frouxa;
- duplicação de relacionamento;
- estado inválido possível.

Para relacionamento trainer/student considerar unicidade apropriada.

---

# 13. MIGRATIONS

Toda alteração de schema deve existir em migration versionada.

Não depender de alteração manual invisível no Supabase.

Preservar compatibilidade.

Nunca apagar dados existentes silenciosamente.

Se migration for destrutiva:

marcar explicitamente risco.

---

# 14. CONCORRÊNCIA

Para operações sensíveis verificar:

- race conditions;
- duplicate insert;
- lost update;
- idempotency;
- retries;
- transações;
- optimistic concurrency.

Especialmente:

- quota;
- convites;
- pagamentos;
- atribuição de treino;
- relacionamento trainer/student.

---

# 15. CSRF / ORIGIN

Para mutações HTTP revisar:

- origin;
- cookies;
- SameSite;
- método;
- autenticação.

Não assumir que Auth sozinho elimina todos os riscos.

Preservar proteções de origin existentes.

---

# 16. PASSWORD / AUTH FLOWS

Senhas:

- nunca persistidas no app;
- nunca logadas;
- nunca enviadas para banco próprio.

Usar Supabase Auth.

Troca de senha:

- validação;
- confirmação;
- reautenticação quando necessária.

Recovery:

- token temporário;
- não expor em logs;
- não persistir;
- não enviar para analytics.

---

# 17. EMAIL / INVITES

Convites:

- expiram;
- não reutilizáveis;
- associados ao trainer correto;
- não permitem escalada de privilégio.

Não confiar apenas no email recebido no frontend.

Validar estado do convite no servidor.

---

# 18. PAGAMENTOS

Atualmente pagamento é controle administrativo.

Não armazenar:

- cartão;
- CVV;
- credenciais bancárias;
- dados financeiros sensíveis desnecessários.

Trainer só gerencia pagamentos de seus próprios alunos.

Aluno só visualiza seus próprios registros quando permitido.

---

# 19. SECURITY REVIEW OUTPUT

Quando esta regra for ativada, o reviewer deve entregar:

## SECURITY STATUS

PASS

ou

CHANGES REQUIRED

## CRITICAL

Problemas que podem causar:

- vazamento de dados;
- escalada de privilégio;
- acesso entre contas;
- exposição de segredo;
- comprometimento de autenticação.

## HIGH

Riscos importantes.

## MEDIUM

Problemas relevantes mas menos graves.

## LOW

Hardening e melhorias.

## REQUIRED FIXES

Correções obrigatórias antes de considerar concluído.

## ACCEPTED RISKS

Riscos conhecidos conscientemente aceitos.

## TESTS

Testes de segurança executados ou necessários.

---

# 20. REGRA FINAL

Se houver dúvida entre:

facilidade de implementação

e

isolamento/segurança dos dados,

priorize segurança e integridade.

Nunca reduza proteção apenas para fazer uma feature funcionar.