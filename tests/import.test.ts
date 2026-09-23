import test from 'node:test';
import assert from 'node:assert/strict';
import {compileImport,parseWorkoutText} from '../lib/fitness/import';
import {library} from '../lib/fitness/seed';

test('organiza uma descrição natural separada por vírgulas',()=>{
 const [draft]=parseWorkoutText('Segunda — Peito e tríceps: supino reto 4x8-10, crossover 3x12 e tríceps pulley 3x10-12',library,75);
 assert.match(draft.name,/Segunda/i);
 assert.equal(draft.rows.length,3);
 assert.deepEqual(draft.rows.map(r=>[r.exerciseId,r.sets,r.minReps,r.maxReps]),[
  ['base-0',4,8,10],['base-3',3,12,12],['base-14',3,10,12]
 ]);
});

test('preserva exercício desconhecido como personalizado após revisão',()=>{
 const drafts=parseWorkoutText('Treino A\nMeu movimento 3x10 60s',library,90);
 const result=compileImport(drafts,library);
 assert.equal(result.custom[0].name,'Meu movimento');
 assert.equal(result.routines[0].exercises[0].exerciseId,result.custom[0].id);
 assert.equal(result.routines[0].exercises[0].rest,60);
});

test('entende agenda semanal, carga, corrida e mobilidade no mesmo texto',()=>{
 const text=`SEMANA RESET

Dia 1 — Treino B
Dia 2 — Corrida Leve
Dia 3 — Recuperação + Pé/Tornozelo

Treino B — Full Body
Puxada Frontal — 3x8-12 — 88 lbs — descanso 90-120s — RIR 2-3
Farmer Carry — 2-3x20-30 m — carga moderada — descanso 60-90s

Corrida Leve
Corrida Leve — 25 min — 7,0 a 7,5 km/h — RPE 3-5

Recuperação + Pé/Tornozelo
Short Foot — 2x8 — segurar 5s
Equilíbrio Unilateral — 2x20-30s por lado`;
 const drafts=parseWorkoutText(text,library,90);
 assert.equal(drafts.length,3);
 assert.deepEqual(drafts.map(d=>d.days),[[1],[2],[3]]);
 assert.equal(drafts[0].rows[0].exerciseId,'base-4');
 assert.ok(Math.abs((drafts[0].rows[0].suggestedWeight??0)-39.916)<.01);
 assert.equal(drafts[0].rows[1].targetType,'meters');
 assert.equal(drafts[1].rows[0].targetType,'minutes');
 assert.equal(drafts[2].rows[1].targetType,'seconds');
});

test('aceita rotina em JSON',()=>{
 const drafts=parseWorkoutText(JSON.stringify({routines:[{name:'Treino JSON',days:[1,4],exercises:[{name:'Leg Press',sets:3,reps:'8-12',weight:'200 kg',rest:120,alternatives:['Agachamento livre','Cadeira extensora']}]}]}),library);
 assert.equal(drafts[0].name,'Treino JSON');
 assert.deepEqual(drafts[0].days,[1,4]);
 assert.equal(drafts[0].rows[0].suggestedWeight,200);
 assert.deepEqual(drafts[0].rows[0].alternativeExerciseIds,['base-17','base-19']);
});

test('linhas vazias entre exercícios não criam rotinas extras',()=>{
 const text=`Corrida Longa Leve
Corrida Longa Leve — 25-35 min — 6,8 a 7,5 km/h

Corrida/Caminhada Alternativa — 4-6 min correndo + 1-2 min andando

Pé e Tornozelo

Short Foot — 2x8 — segurar 5s

Toe Yoga — 2x8`;
 const drafts=parseWorkoutText(text,library);
 assert.equal(drafts.length,2);
 assert.deepEqual(drafts.map(d=>d.rows.length),[2,2]);
});

test('importa semana com duas sessões no mesmo dia, futebol, metas de carga e descanso',()=>{
 const text=`SEMANA PADRÃO
Dia 1 — Segunda: Push (manhã) + Pull (noite)
Dia 2 — Terça: Pernas A (quadríceps) + futebol
Dia 3 — Quarta: Ombros + abdômen
Dia 4 — Quinta: Pernas B (posterior e glúteos)
Dia 5 — Sexta: Upper (pontos fracos)
Dia 6 — Sábado: Posterior e glúteos
Dia 7 — Domingo: descanso

SEGUNDA — PUSH (MANHÃ)
Supino reto — 3×6–8 — cargas alvo: 100 / 110 / 120 kg — descanso 180 s
Supino inclinado na máquina — 3×8–10 — aumentar a carga a cada série — descanso 120 s
Desenvolvimento de ombros na máquina — 3×8–10 — cargas alvo: 25 / 30 / 32,5 kg por lado — descanso 120 s

SEGUNDA — PULL (NOITE)
Puxada alta — 3×8–12 — aumentar a carga a cada série — descanso 120 s
Remada com apoio — 3×8–10 — progredir até 110 kg se a execução estiver firme — descanso 120 s

TERÇA — PERNAS A (ÊNFASE EM QUADRÍCEPS)
Agachamento — 3×6–10 — começar com 120 kg e progredir conforme a execução — descanso 180 s
Leg press — 3×10–12 — começar com 160–200 kg; manter a lombar apoiada — descanso 180 s
Cardio — futebol, aproximadamente 1 h.

QUARTA — OMBROS + ABDÔMEN
ISO-Lateral Shoulder Press — 3×8–10 — cargas alvo: 25 / 30 / 32,5 kg por lado — descanso 120 s
Cardio — bike ou remador, 15 min em ritmo moderado.

QUINTA — PERNAS B (ÊNFASE EM POSTERIOR E GLÚTEOS)
Mesa flexora — 3×8–12 — progredir até 120 kg se a execução estiver controlada — descanso 120 s
Extensão de quadril no cabo — 3×12–15 por perna — descanso 75 s

SEXTA — UPPER (PONTOS FRACOS)
Chest press — 3×6–10 — progredir até 140 kg se a execução estiver firme — descanso 120 s
Cardio — bike ou esteira sem motor, 10–15 min em ritmo moderado.

SÁBADO — POSTERIOR E GLÚTEOS
Abdutora — 3×12–15 — descanso 75 s
Cardio — bike leve, 15 min.

DOMINGO — DESCANSO`;
 const drafts=parseWorkoutText(text,library);
 assert.equal(drafts.length,7);
 assert.deepEqual(drafts.map(d=>d.days),[[1],[1],[2],[3],[4],[5],[6]]);
 assert.deepEqual(drafts.map(d=>d.rows.length),[3,2,3,2,2,2,2]);
 assert.deepEqual(drafts[0].rows[0].targetWeights,[100,110,120]);
 assert.equal(drafts[0].rows[0].suggestedWeight,100);
 assert.equal(drafts[0].rows[0].rest,180);
 assert.equal(drafts[0].rows[2].suggestedWeight,null);
 assert.match(drafts[0].rows[2].loadText,/25 \/ 30 \/ 32,5 kg por lado/);
 assert.equal(drafts[1].rows[1].suggestedWeight,null);
 assert.equal(drafts[2].rows[1].suggestedWeight,160);
 assert.equal(drafts[2].rows[2].exerciseId,'base-51');
 assert.equal(drafts[2].rows[2].targetType,'minutes');
 assert.equal(drafts[2].rows[2].minReps,60);
 assert.equal(drafts[3].rows[1].exerciseId,'base-34');
 assert.equal(drafts[3].rows[1].minReps,15);
 assert.equal(drafts[5].rows[1].maxReps,15);
 const compiled=compileImport(drafts,library);
 assert.deepEqual(compiled.routines[0].exercises[0].targetWeights,[100,110,120]);
 assert.equal(compiled.routines.filter(r=>r.days.includes(0)).length,0);
});
