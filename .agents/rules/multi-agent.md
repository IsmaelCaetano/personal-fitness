---
trigger: model_decision
description: "Orquestra múltiplos agentes especializados para tarefas médias, grandes, críticas ou que envolvam várias áreas do Personal Fitness."
---

# Personal Fitness — Multi-Agent Engineering

Para tarefas médias, grandes, críticas ou que envolvam múltiplas áreas do projeto, trabalhe como uma equipe de agentes especializados.

Não use múltiplos agentes desnecessariamente para alterações triviais.

## Objetivo

Separar:

- investigação;
- arquitetura;
- implementação;
- segurança;
- revisão;
- integração.

O agente que implementa NÃO deve ser o único responsável por validar a própria implementação.

---

# 1. ORCHESTRATOR / ARCHITECT

Existe sempre um agente principal responsável por coordenar a tarefa.

Ele deve primeiro ler:

1. `AGENTS.md`
2. `PROJECT_HANDOFF.md`
3. `docs/PROJECT_CONTEXT.md`
4. seção relevante de `SPEC.md`
5. `TASKS.md`

Responsabilidades:

- entender o pedido;
- entender o estado atual;
- definir impacto;
- localizar áreas afetadas;
- identificar riscos;
- dividir a tarefa em partes;
- escolher agentes necessários;
- decidir o que pode rodar em paralelo;
- impedir edições conflitantes;
- integrar resultados;
- garantir coerência arquitetural.

O Orchestrator deve evitar executar uma grande implementação sem antes entender a arquitetura existente.

Antes de delegar, produzir internamente um Context Pack:

## TASK
Objetivo da tarefa.

## CURRENT CONTEXT
Comportamento atual relevante.

## FILES
Arquivos provavelmente envolvidos.

## INVARIANTS
Regras que não podem ser quebradas.

## RISKS
Principais riscos.

## ACCEPTANCE CRITERIA
Como saber que terminou corretamente.

Esse contexto deve ser enviado aos demais agentes.

Não obrigar cada agente a redescobrir o repositório inteiro.

---

# 2. CODEBASE ANALYST

Responsável por investigar antes da implementação.

Normalmente NÃO deve alterar código.

Deve:

- buscar símbolos;
- localizar fluxo atual;
- identificar componentes relacionados;
- identificar APIs relacionadas;
- identificar schemas;
- identificar tabelas;
- identificar testes existentes;
- entender fluxo de dados;
- verificar documentação;
- identificar possíveis regressões;
- encontrar causa raiz quando houver bug.

Entregar:

## CURRENT BEHAVIOR

## ROOT CAUSE

## DATA FLOW

## FILES INVOLVED

## EXISTING TESTS

## RISKS

## RECOMMENDED APPROACH

## TESTS NEEDED

O objetivo é evitar que o Implementer comece modificando código baseado em suposições.

---

# 3. IMPLEMENTER

Responsável por escrever código.

Recebe o Context Pack e a análise.

Deve:

- implementar somente o escopo solicitado;
- reutilizar componentes existentes;
- reutilizar funções existentes;
- preservar arquitetura;
- preservar compatibilidade;
- evitar refactor não relacionado;
- criar/atualizar testes;
- atualizar tipos/schemas quando necessário;
- atualizar documentação relacionada.

Nunca:

- remover código funcionando apenas para simplificar;
- alterar arquitetura sem necessidade;
- contornar RLS;
- colocar segredo no client;
- confiar em autorização somente da UI;
- esconder erro com workaround visual.

Ao concluir entregar:

## IMPLEMENTATION

## FILES CHANGED

## TESTS ADDED

## ASSUMPTIONS

## RISKS

## REMAINING WORK

O Implementer NÃO aprova sozinho a implementação.

---

# 4. SECURITY / DATABASE REVIEWER

Ative obrigatoriamente quando a tarefa envolver:

- Supabase;
- banco;
- Auth;
- RLS;
- API;
- migrations;
- Trainer/Aluno;
- convites;
- quotas;
- service role;
- pagamentos;
- uploads;
- informações pessoais;
- IA recebendo dados do usuário;
- endpoints sensíveis.

Revisar:

## AUTHENTICATION

- usuário autenticado corretamente?
- sessão verificada server-side?
- fluxo de callback correto?

## AUTHORIZATION

- usuário acessa somente recursos permitidos?
- existe IDOR?
- user_id recebido do cliente é confiado indevidamente?

## RLS

- SELECT protegido?
- INSERT protegido?
- UPDATE protegido?
- DELETE protegido?

## INPUT

- Zod?
- tamanho?
- formato?
- limites?
- dados inesperados?

## SECRETS

Nunca permitir exposição de:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- SMTP password
- JWT
- recovery token
- confirmation token
- senhas.

## DATABASE

Verificar:

- PK;
- FK;
- indexes;
- constraints;
- uniqueness;
- concorrência;
- transações;
- migrations;
- RLS.

## LOGGING

Não permitir logs contendo:

- senha;
- token;
- JWT;
- API key;
- ConfirmationURL.

Para Trainer/Aluno, verificar obrigatoriamente:

Trainer A -> seu aluno:
PERMITIDO

Trainer A -> aluno do Trainer B:
NEGADO

Aluno A -> dados do Aluno B:
NEGADO

Aluno -> editar estrutura bloqueada pelo trainer:
NEGADO

Aluno -> registrar sua própria execução:
PERMITIDO

Entregar:

## SECURITY FINDINGS

### CRITICAL

### HIGH

### MEDIUM

### LOW

## REQUIRED FIXES

## ACCEPTED RISKS

---

# 5. REVIEWER / QA

Responsável por revisar independentemente o resultado.

NÃO confiar apenas no resumo do Implementer.

Primeiro revisar:

`git diff`

Depois comparar implementação com:

- pedido;
- SPEC;
- arquitetura;
- critérios de aceite.

Revisar:

- lógica;
- edge cases;
- regressões;
- compatibilidade;
- erros;
- loading;
- empty state;
- segurança;
- responsividade;
- acessibilidade básica.

Executar quando aplicável:

`pnpm test`

`pnpm typecheck`

`pnpm lint`

`pnpm check`

Para UI:

usar navegador.

Testar quando aplicável:

- desktop;
- mobile;
- happy path;
- erro;
- loading;
- empty state;
- refresh;
- navegação;
- console;
- requests HTTP.

Para concorrência:

- operações simultâneas;
- retry;
- resposta perdida;
- duas abas;
- conflito verdadeiro.

Para segurança:

- caminho permitido;
- caminho proibido.

Entregar:

## REVIEW RESULT

`PASS`

ou

`CHANGES REQUIRED`

## FINDINGS

## REGRESSIONS

## SECURITY

## TEST RESULTS

## BROWSER RESULTS

Se houver:

`CHANGES REQUIRED`

o Orchestrator deve devolver a tarefa ao Implementer.

Depois o Reviewer revisa novamente.

Repetir até:

`PASS`

ou existir um bloqueio real documentado.

---

# 6. INTEGRATOR

Responsável pela verificação final.

Somente entra depois da implementação e revisão.

Deve:

- garantir integração das mudanças;
- detectar inconsistências entre agentes;
- verificar migrations;
- verificar imports;
- verificar tipos;
- verificar documentação;
- verificar arquivos não intencionais;
- verificar segredos.

Executar:

`pnpm test`

`pnpm typecheck`

`pnpm lint`

`pnpm build`

`pnpm check`

Depois:

`git status`

e:

`git diff`

Verificar que não existem:

- arquivos temporários;
- segredos;
- código morto óbvio;
- documentação incorreta;
- mudanças fora do escopo.

Atualizar documentação relevante quando necessário:

- `README.md`
- `SPEC.md`
- `TASKS.md`
- `AGENTS.md`
- `PROJECT_HANDOFF.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/AI.md`
- `SECURITY.md`

---

# 7. PARALELISMO

Agentes podem trabalhar em paralelo SOMENTE quando suas áreas não entram em conflito.

Bom:

Agent A:
PDF

Agent B:
documentação

Agent C:
testes isolados

Ruim:

Agent A:
altera `lib/fitness/model.ts`

Agent B:
altera `lib/fitness/model.ts`

Agent C:
altera `lib/fitness/model.ts`

Nunca permitir múltiplos writers simultâneos nos mesmos arquivos.

Quando houver sobreposição:

executar sequencialmente.

---

# 8. ESCALA DE AGENTES

Não usar toda a equipe para tarefas triviais.

## Tarefa pequena

Exemplo:

- texto;
- CSS pequeno;
- correção localizada.

Usar:

Orchestrator/Implementer
+
Reviewer quando necessário.

## Tarefa média

Exemplo:

- nova feature;
- mudança em vários componentes;
- PDF;
- melhoria de importação.

Usar:

Orchestrator
Analyst
Implementer
Reviewer

## Tarefa crítica

Exemplo:

- Auth;
- Supabase;
- RLS;
- banco;
- Trainer/Aluno;
- concorrência;
- migrations;
- quotas;
- segurança.

Usar:

Orchestrator
Analyst
Implementer
Security/DB Reviewer
Reviewer/QA
Integrator

---

# 9. CONTEXT ENGINEERING

Minimize uso de contexto e tokens.

Use como memória compartilhada:

- `AGENTS.md`
- `PROJECT_HANDOFF.md`
- `docs/PROJECT_CONTEXT.md`
- `SPEC.md`
- `TASKS.md`

O Orchestrator deve fornecer a cada agente somente:

- tarefa;
- arquivos relevantes;
- contexto necessário;
- invariantes;
- riscos;
- critérios de aceite.

Não enviar o repositório inteiro para cada agente.

Não reler arquivos grandes sem necessidade.

Se descobrir informação importante para trabalho futuro:

registre na documentação.

---

# 10. CICLO OBRIGATÓRIO PARA TAREFAS IMPORTANTES

Fluxo:

Orchestrator
↓
Analyst
↓
Implementer
↓
Security/DB Review, quando necessário
↓
Reviewer/QA
↓
Encontrou problema?

SIM
↓
Implementer corrige
↓
Reviewer revisa novamente

NÃO
↓
Integrator
↓
Final checks

Uma feature importante NÃO está concluída apenas porque o agente que escreveu o código declarou que funciona.

---

# 11. ENTREGA FINAL

Somente o Orchestrator apresenta o resultado final.

Formato:

## TASK

## AGENTS USED

## IMPLEMENTATION

## FILES CHANGED

## DATABASE

## SECURITY REVIEW

## QA REVIEW

## TEST RESULTS

- pnpm test:
- pnpm typecheck:
- pnpm lint:
- pnpm build:
- pnpm check:

## BROWSER TEST

## DOCUMENTATION

## RISKS

## BLOCKED

## MANUAL TEST

Não expor raciocínio interno ou conversas privadas entre agentes.

Apresentar somente conclusões, mudanças e evidências.